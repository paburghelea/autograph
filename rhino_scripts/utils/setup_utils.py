"""
Setup utilities for building a graph from the current Rhino scene
and pushing it to the GraphHopper API.

- Each Rhino object becomes a GraphNode (id = GUID).
- Objects that share the same user-string key-value pair are connected
  with a GraphLink whose name is "shared:<key>=<value>".
- Colliding objects are connected with a GraphLink whose name is "collision".
"""

import json
import networkx as nx
import Rhino
import scriptcontext as sc
try:
    # Preferred when imported as utils.setup_utils
    from . import config
except Exception:
    try:
        # Fallback when utils is available on sys.path
        import utils.config as config
    except Exception:
        # Last-resort fallback
        import config

_log = lambda msg: Rhino.RhinoApp.WriteLine(str(msg))

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
API_BASE_URL = getattr(config, "API_BASE_URL", "https://graphhopper.vercel.app")
if isinstance(API_BASE_URL, str) and (
    "localhost" in API_BASE_URL.lower() or "127.0.0.1" in API_BASE_URL
):
    # Safety fallback in case an older/local config module gets imported.
    API_BASE_URL = "https://graphhopper.vercel.app"
GRAPH_ENDPOINT = config.GRAPH_ENDPOINT
GRAPH_ID_STICKY_KEY = config.GRAPH_ID_STICKY_KEY


# ---------------------------------------------------------------------------
# HTTP helpers (Python 3 / urllib)
# ---------------------------------------------------------------------------

import urllib.request
import urllib.error


def _http_request(url, method="GET", payload=None):
    """Send an HTTP request and return the response body as a string."""
    headers = {}
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.read().decode("utf-8")
    except urllib.error.HTTPError as ex:
        body = ""
        try:
            body = ex.read().decode("utf-8")
        except Exception:
            pass
        _log("[ERROR] {} {} failed (HTTP {}): {}".format(method, url, ex.code, body))
        raise
    except urllib.error.URLError as ex:
        _log("[ERROR] {} {} failed: {}".format(method, url, ex.reason))
        raise


def _post_json(url, payload):
    """POST a JSON payload and return the response body."""
    return _http_request(url, method="POST", payload=payload)


def _patch_json(url, payload):
    """PATCH a JSON payload and return the response body."""
    return _http_request(url, method="PATCH", payload=payload)


def _get_json(url):
    """GET a JSON endpoint and return the response body."""
    return _http_request(url, method="GET")


def _try_parse_json(text):
    try:
        return json.loads(text)
    except Exception:
        return None


def _extract_graph_id(payload_obj):
    """Best-effort extraction of graph id from an API response object."""
    if not isinstance(payload_obj, dict):
        return None
    for key in ("id", "graphId", "_id"):
        if key in payload_obj:
            return payload_obj.get(key)
    if isinstance(payload_obj.get("data"), dict):
        for key in ("id", "graphId", "_id"):
            if key in payload_obj["data"]:
                return payload_obj["data"].get(key)
    return None


def _find_existing_graph_id_by_name(graph_name):
    """Try to find an existing graph by name via GET /api/graphs."""
    try:
        raw = _get_json(API_BASE_URL + GRAPH_ENDPOINT)
    except Exception:
        return None

    data = _try_parse_json(raw)
    if data is None:
        return None

    candidates = []
    if isinstance(data, list):
        candidates = data
    elif isinstance(data, dict):
        if isinstance(data.get("data"), list):
            candidates = data.get("data")
        elif isinstance(data.get("graphs"), list):
            candidates = data.get("graphs")

    for item in candidates:
        if isinstance(item, dict) and item.get("name") == graph_name:
            gid = _extract_graph_id(item)
            if gid:
                return gid
    return None


def _upsert_graph(graph_name, payload):
    """
    Upsert graph resource:
    - create graph if it does not exist,
    - otherwise overwrite existing graph via PATCH.
    - if PATCH returns 404, clear cache and fall back to POST.
    """
    graph_id = sc.sticky.get(GRAPH_ID_STICKY_KEY)
    if not graph_id:
        graph_id = _find_existing_graph_id_by_name(graph_name)
        if graph_id:
            sc.sticky[GRAPH_ID_STICKY_KEY] = graph_id

    if graph_id:
        patch_url = API_BASE_URL + GRAPH_ENDPOINT + "/{}".format(graph_id)
        patch_payload = {
            "name": payload.get("name"),
            "graph": payload.get("graph"),
        }
        try:
            response = _patch_json(patch_url, patch_payload)
            return "updated", response
        except Exception as ex:
            # If we get a 404, the graph was deleted server-side.
            # Clear the stale ID and fall through to POST below.
            is_404 = False
            if hasattr(ex, "code") and ex.code == 404:
                is_404 = True
            elif "404" in str(ex):
                is_404 = True
            if is_404:
                _log("[upsert] Cached graph ID '{}' returned 404 — "
                     "creating a new graph instead.".format(graph_id))
                sc.sticky.pop(GRAPH_ID_STICKY_KEY, None)
            else:
                raise

    response = _post_json(API_BASE_URL + GRAPH_ENDPOINT, payload)
    obj = _try_parse_json(response)
    created_id = _extract_graph_id(obj)
    if created_id:
        sc.sticky[GRAPH_ID_STICKY_KEY] = created_id
    return "created", response


# ---------------------------------------------------------------------------
# Scene scanning
# ---------------------------------------------------------------------------

def _collect_nodes_and_attrs(doc):
    """
    Walk every object in the Rhino document.

    Returns
    -------
    nodes : list[dict]
        List of GraphNode dicts (id, name, + user-string metadata).
    kv_index : dict[(key, value)] -> list[str]
        Maps each shared (key, value) pair to the list of object-id strings
        that carry it.
    """
    nodes = []
    kv_index = {}  # (key, value) -> [guid_str, ...]

    for obj in doc.Objects:
        if obj is None:
            continue

        guid_str = str(obj.Id)
        attrs = obj.Attributes

        # -- build node dict --------------------------------------------------
        node = {"id": guid_str}

        # display name
        obj_name = attrs.Name
        if obj_name:
            node["name"] = obj_name
        else:
            node["name"] = guid_str

        # geometry type as metadata
        if obj.Geometry:
            node["objectType"] = str(obj.Geometry.ObjectType)

        # layer name
        layer_idx = attrs.LayerIndex
        if layer_idx >= 0 and layer_idx < doc.Layers.Count:
            node["layer"] = doc.Layers[layer_idx].FullPath

        # user strings -> metadata + kv_index
        us = attrs.GetUserStrings()
        if us and us.Count > 0:
            for key in us.AllKeys:
                val = attrs.GetUserString(key)
                node[key] = val
                kv_pair = (key, val)
                kv_index.setdefault(kv_pair, []).append(guid_str)

        nodes.append(node)

    return nodes, kv_index


def _build_attribute_links(kv_index):
    """
    Create GraphLink entries for every pair of objects that share
    the same user-string key-value pair.

    Parameters
    ----------
    kv_index : dict[(key, value)] -> list[str]

    Returns
    -------
    list[dict]   –  list of GraphLink dicts
    """
    links = []
    seen = set()

    for (key, val), guid_list in kv_index.items():
        if len(guid_list) < 2:
            continue
        for i in range(len(guid_list)):
            for j in range(i + 1, len(guid_list)):
                src, tgt = guid_list[i], guid_list[j]
                edge_id = (src, tgt, key, val) if src < tgt else (tgt, src, key, val)
                if edge_id in seen:
                    continue
                seen.add(edge_id)
                links.append({
                    "source": src,
                    "target": tgt,
                    "name": "shared:{}={}".format(key, val),
                    "sharedKey": key,
                    "sharedValue": val,
                })
    return links


# ---------------------------------------------------------------------------
# Collision-based connections
# ---------------------------------------------------------------------------

CLASH_DISTANCE = getattr(config, "CLASH_DISTANCE", 0.01)


def _mesh_object(rhino_obj, mesh_params):
    """
    Return a single Rhino.Geometry.Mesh for *rhino_obj*, or None.

    Handles Brep, Extrusion, Mesh, and SubD geometry types.
    Extrusions are converted to Brep first.  SubD objects are
    converted via ``ToSubDMesh`` or ``ToMesh`` when available.
    """
    geo = rhino_obj.Geometry
    if geo is None:
        return None

    otype = geo.ObjectType

    # Already a mesh --------------------------------------------------------
    if otype == Rhino.DocObjects.ObjectType.Mesh:
        return geo

    # Brep / Polysurface / Surface ------------------------------------------
    if otype == Rhino.DocObjects.ObjectType.Brep:
        parts = Rhino.Geometry.Mesh.CreateFromBrep(geo, mesh_params)
        if parts:
            joined = Rhino.Geometry.Mesh()
            for m in parts:
                joined.Append(m)
            return joined
        return None

    # Extrusion (lightweight Brep) ------------------------------------------
    if otype == Rhino.DocObjects.ObjectType.Extrusion:
        brep = geo.ToBrep()
        if brep:
            parts = Rhino.Geometry.Mesh.CreateFromBrep(brep, mesh_params)
            if parts:
                joined = Rhino.Geometry.Mesh()
                for m in parts:
                    joined.Append(m)
                return joined
        return None

    # SubD ------------------------------------------------------------------
    if otype == Rhino.DocObjects.ObjectType.SubD:
        if hasattr(geo, "ToMesh"):
            mesh = geo.ToMesh(Rhino.Geometry.MeshingParameters.Minimal)
            if mesh:
                return mesh
        return None

    return None


def _mesh_all_objects(doc):
    """
    Iterate every object in *doc*, create a lightweight mesh for each
    meshable object, and return parallel lists.

    Returns
    -------
    guid_strs : list[str]
    meshes    : list[Rhino.Geometry.Mesh]
    """
    mesh_params = Rhino.Geometry.MeshingParameters.Minimal

    guid_strs = []
    meshes = []

    for obj in doc.Objects:
        if obj is None:
            continue
        mesh = _mesh_object(obj, mesh_params)
        if mesh is None:
            continue
        guid_strs.append(str(obj.Id))
        meshes.append(mesh)

    return guid_strs, meshes


def _min_mesh_distance(mesh_a, mesh_b, max_samples=64):
    """
    Estimate the minimum distance between two meshes by sampling
    vertices of *mesh_a* and finding the closest point on *mesh_b*,
    then vice-versa.  Returns the smallest distance found.

    Parameters
    ----------
    mesh_a, mesh_b : Rhino.Geometry.Mesh
    max_samples : int
        Maximum number of vertices to sample per mesh (evenly spaced).
    """
    best = float("inf")

    for src, tgt in [(mesh_a, mesh_b), (mesh_b, mesh_a)]:
        verts = src.Vertices
        vert_count = verts.Count
        if vert_count == 0:
            continue
        step = max(1, vert_count // max_samples)
        for idx in range(0, vert_count, step):
            pt = Rhino.Geometry.Point3d(verts[idx])
            closest = tgt.ClosestPoint(pt)
            if closest is not None and closest != Rhino.Geometry.Point3d.Unset:
                d = pt.DistanceTo(closest)
                if d < best:
                    best = d
                    if best == 0.0:
                        return 0.0
    return best


def _clash_via_rtree(meshes, guid_strs, tolerance):
    """
    Broad-phase RTree bounding-box filter + narrow-phase collision check.

    Narrow-phase:
      1. ``MeshMeshFast`` — catches actual penetrating intersections.
      2. If no intersection, sample-based minimum-distance check — catches
         touching / near-miss pairs within *tolerance*.

    Returns set of (guid_a, guid_b) tuples (sorted order).
    """
    count = len(meshes)
    if count < 2:
        return set()

    # Pre-compute bounding boxes (un-transformed, fastest) ------------------
    bboxes = []
    for m in meshes:
        bb = m.GetBoundingBox(False)
        if tolerance > 0:
            bb.Inflate(tolerance)
        bboxes.append(bb)

    # Build RTree from all bounding boxes -----------------------------------
    tree = Rhino.Geometry.RTree()
    for i, bb in enumerate(bboxes):
        tree.Insert(bb, i)

    # Query each object; callback filters j > i to avoid duplicates ---------
    pairs = set()
    Intersection = Rhino.Geometry.Intersect.Intersection

    for i in range(count):
        candidates = []

        # Closure that captures the current index and candidate list
        def _make_cb(idx, cands):
            def _cb(sender, e):
                if e.Id > idx:
                    cands.append(e.Id)
            return _cb

        tree.Search(bboxes[i], _make_cb(i, candidates))

        # Narrow-phase on candidate pairs only
        for j in candidates:
            hit = False

            # 1) Fast intersection test (actual penetration)
            lines = Intersection.MeshMeshFast(meshes[i], meshes[j])
            if lines and len(lines) > 0:
                hit = True

            # 2) Distance test (touching / near-miss within tolerance)
            if not hit and tolerance > 0:
                dist = _min_mesh_distance(meshes[i], meshes[j])
                if dist <= tolerance:
                    hit = True

            if hit:
                a, b = guid_strs[i], guid_strs[j]
                pair = (a, b) if a < b else (b, a)
                pairs.add(pair)

    return pairs


def build_collision_links(doc):
    """
    Create GraphLink entries for every pair of objects whose meshes
    collide / intersect in the scene.

    Uses RTree broad-phase (bounding-box overlap) to find candidate
    pairs in O(n log n), then confirms with ``MeshMeshFast`` narrow-
    phase intersection.

    Parameters
    ----------
    doc : Rhino.RhinoDoc
        The active Rhino document.

    Returns
    -------
    list[dict]
        List of GraphLink dicts with ``name="collision"``.
    """
    guid_strs, meshes = _mesh_all_objects(doc)
    count = len(meshes)
    if count < 2:
        _log("[collision] < 2 meshable objects — skipping clash detection.")
        return []

    _log("[collision] Meshed {} objects. Running clash detection "
         "(distance={})...".format(count, CLASH_DISTANCE))

    pairs = _clash_via_rtree(meshes, guid_strs, CLASH_DISTANCE)
    _log("[collision] Found {} colliding pair(s).".format(len(pairs)))

    # Build GraphLink dicts
    links = []
    for src, tgt in pairs:
        links.append({
            "source": src,
            "target": tgt,
            "name": "collision",
        })
    return links


# ---------------------------------------------------------------------------
# NetworkX graph (stored in sc.sticky)
# ---------------------------------------------------------------------------

STICKY_KEY = config.NX_GRAPH_STICKY_KEY


def _build_networkx_graph(nodes, links):
    """
    Build a NetworkX DiGraph from the collected nodes and links and
    store it in ``sc.sticky`` so it survives across script runs inside
    the same Rhino session.  Overwrites any previous graph.

    Parameters
    ----------
    nodes : list[dict]
        GraphNode dicts (must contain at least ``id``).
    links : list[dict]
        GraphLink dicts (must contain ``source`` and ``target``).

    Returns
    -------
    networkx.DiGraph
    """
    G = nx.DiGraph()

    for node in nodes:
        nid = node["id"]
        # pass every key except "id" as a node attribute
        attrs = {k: v for k, v in node.items() if k != "id"}
        G.add_node(nid, **attrs)

    for link in links:
        src = link["source"]
        tgt = link["target"]
        attrs = {k: v for k, v in link.items() if k not in ("source", "target")}
        G.add_edge(src, tgt, **attrs)

    # Overwrite the sticky variable
    sc.sticky[STICKY_KEY] = G
    _log("[setup_graph] NetworkX graph stored in sc.sticky['{}'] "
         "({} nodes, {} edges).".format(STICKY_KEY, G.number_of_nodes(), G.number_of_edges()))
    return G


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def setup_graph(graph_name=None):
    """
    Scan the active Rhino document, build a graph from all objects and
    their user-string attributes, and POST it to the API.

    Parameters
    ----------
    graph_name : str, optional
        Human-readable name for the graph.  Defaults to the document name.

    Returns
    -------
    str   – the raw JSON response from the API, or None on failure.
    """
    doc = Rhino.RhinoDoc.ActiveDoc
    if doc is None:
        _log("[setup_graph] No active Rhino document.")
        return None

    if graph_name is None:
        graph_name = doc.Name or "Untitled Rhino Graph"

    _log("[setup_graph] Scanning scene '{}'...".format(graph_name))
    _log("[setup_graph] Using API base URL: {}".format(API_BASE_URL))

    # 1. Collect nodes + shared-attribute index
    nodes, kv_index = _collect_nodes_and_attrs(doc)
    _log("[setup_graph] Found {} object(s).".format(len(nodes)))

    # 2. Build links from shared key-value pairs
    attr_links = _build_attribute_links(kv_index)
    _log("[setup_graph] Created {} attribute-based link(s).".format(len(attr_links)))

    # 3. Build links from mesh collisions
    collision_links = build_collision_links(doc)
    _log("[setup_graph] Created {} collision-based link(s).".format(len(collision_links)))

    all_links = attr_links + collision_links

    # 4. Build & store a NetworkX graph in sc.sticky
    G = _build_networkx_graph(nodes, all_links)

    # 5. Assemble CreateGraphPayload (links grouped into named sets)
    link_sets = []
    if attr_links:
        link_sets.append({
            "set": "attributes",
            "notes": "Edges between objects sharing the same user-string key-value pair",
            "links": attr_links,
        })
    if collision_links:
        link_sets.append({
            "set": "collisions",
            "notes": "Edges between objects whose meshes collide (distance={})".format(CLASH_DISTANCE),
            "links": collision_links,
        })

    payload = {
        "name": graph_name,
        "graph": {
            "nodes": nodes,
            "links": link_sets,
        },
    }

    # 6. Upsert graph in API (best-effort – do not crash if API is unreachable)
    _log("[setup_graph] Upserting graph via API ({})...".format(
        API_BASE_URL + GRAPH_ENDPOINT))
    try:
        action, response = _upsert_graph(graph_name, payload)
        _log("[setup_graph] API {} graph successfully.".format(action))
        _log("[setup_graph] API response:\n{}".format(response))
        return response
    except Exception as ex:
        _log("[setup_graph] WARNING: Could not reach API – {}".format(ex))
        _log("[setup_graph] The NetworkX graph is still available in "
             "sc.sticky['{}'].".format(STICKY_KEY))
        return None
