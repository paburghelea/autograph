# -*- coding: utf-8 -*-
"""
Setup utilities for building a graph from the current Rhino scene
and pushing it to the GraphHopper API.

- Each Rhino object becomes a GraphNode (id = GUID).
- Objects that share the same user-string key-value pair are connected
  with a GraphLink whose name is "shared:<key>=<value>".
- Colliding objects are connected with a GraphLink whose name is "collision".
"""

import json
import Rhino
import scriptcontext as sc
try:
    import networkx as nx
except Exception:
    class _FallbackDiGraph(object):
        """Minimal DiGraph-like fallback used when networkx is unavailable."""

        def __init__(self):
            self._nodes = {}
            self._edges = {}

        def add_node(self, node_id, **attrs):
            self._nodes[node_id] = dict(attrs or {})

        def add_edge(self, source, target, **attrs):
            self._edges[(source, target)] = dict(attrs or {})

        def number_of_nodes(self):
            return len(self._nodes)

        def number_of_edges(self):
            return len(self._edges)

        def edges(self, data=False):
            if data:
                return [(u, v, dict(attrs)) for (u, v), attrs in self._edges.items()]
            return list(self._edges.keys())

    class _FallbackNx(object):
        DiGraph = _FallbackDiGraph

    nx = _FallbackNx()
try:
    # Preferred when imported as utils.setup_utils
    from . import collision_utils
except Exception:
    try:
        # Fallback when utils is available on sys.path
        import utils.collision_utils as collision_utils
    except Exception:
        # Last-resort fallback
        import collision_utils
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
# HTTP helpers (Python 2/3 compatible urllib)
# ---------------------------------------------------------------------------

try:
    import urllib.request as _urllib_request
    import urllib.error as _urllib_error
except Exception:
    import urllib2 as _urllib_request
    import urllib2 as _urllib_error


def _http_request(url, method="GET", payload=None):
    """Send an HTTP request and return the response body as a string."""
    headers = {}
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = _urllib_request.Request(url, data=data, headers=headers)
    if hasattr(req, "get_method"):
        req.get_method = lambda: method
    resp = None
    try:
        resp = _urllib_request.urlopen(req, timeout=15)
        return resp.read().decode("utf-8")
    except _urllib_error.HTTPError as ex:
        body = ""
        try:
            body = ex.read().decode("utf-8")
        except Exception:
            pass
        _log("[ERROR] {} {} failed (HTTP {}): {}".format(method, url, ex.code, body))
        raise
    except _urllib_error.URLError as ex:
        reason = ex.reason if hasattr(ex, "reason") else str(ex)
        _log("[ERROR] {} {} failed: {}".format(method, url, reason))
        raise
    finally:
        try:
            if resp is not None:
                resp.close()
        except Exception:
            pass


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

        # geometry type + geometric properties as metadata
        geo = obj.Geometry
        if geo:
            node["objectType"] = str(geo.ObjectType)

            # --- Volume & Surface Area ---
            # Try to compute from Brep (works for polysurfaces, solids, etc.)
            brep = None
            otype = geo.ObjectType

            if otype == Rhino.DocObjects.ObjectType.Brep:
                brep = geo

            elif otype == Rhino.DocObjects.ObjectType.Extrusion:
                brep = geo.ToBrep()

            elif otype == Rhino.DocObjects.ObjectType.SubD:
                if hasattr(geo, "ToBrep"):
                    brep = geo.ToBrep()

            if brep is not None:
                mp = Rhino.Geometry.VolumeMassProperties.Compute(brep)
                if mp is not None:
                    node["volume"] = round(mp.Volume, 6)
                amp = Rhino.Geometry.AreaMassProperties.Compute(brep)
                if amp is not None:
                    node["surfaceArea"] = round(amp.Area, 6)

            elif otype == Rhino.DocObjects.ObjectType.Mesh:
                mp = Rhino.Geometry.VolumeMassProperties.Compute(geo)
                if mp is not None:
                    node["volume"] = round(mp.Volume, 6)
                amp = Rhino.Geometry.AreaMassProperties.Compute(geo)
                if amp is not None:
                    node["surfaceArea"] = round(amp.Area, 6)

        # faulty flag (default True)
        node["faulty"] = False

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
    for (key, val), guid_list in kv_index.items():
        links.extend(_build_links_for_shared_pair(key, val, guid_list))
    return links


def _build_links_for_shared_pair(key, val, guid_list):
    """Build star-topology links for one shared key/value pair.

    Instead of enumerating all O(n²) pairwise edges, connect every member
    to the first member (hub).  This produces O(n) edges while preserving
    full connectivity — all members remain reachable from each other.
    """
    if not guid_list or len(guid_list) < 2:
        return []

    # Deduplicate while keeping order
    seen_ids = set()
    unique = []
    for g in guid_list:
        if g not in seen_ids:
            seen_ids.add(g)
            unique.append(g)

    if len(unique) < 2:
        return []

    hub = unique[0]
    links = []
    for member in unique[1:]:
        links.append({
            "source": hub,
            "target": member,
        })

    return links


def _build_link_sets(kv_index, collision_links):
    """Build GraphData-compatible link sets (one per shared key/category).

    Uses star-topology links to keep the payload compact (linear in
    node count instead of quadratic).
    """
    link_sets = []

    # Group by key, then add star-topology edges per shared value.
    key_to_value_map = {}
    for (key, val), guid_list in kv_index.items():
        key_to_value_map.setdefault(key, {})[val] = guid_list

    for key in sorted(key_to_value_map.keys(), key=lambda k: str(k)):
        value_map = key_to_value_map[key]
        key_links = []
        seen = set()

        for val in sorted(value_map.keys(), key=lambda v: str(v)):
            for link in _build_links_for_shared_pair(key, val, value_map[val]):
                src, tgt = link["source"], link["target"]
                edge_id = (src, tgt) if src < tgt else (tgt, src)
                if edge_id in seen:
                    continue
                seen.add(edge_id)
                key_links.append(link)

        if not key_links:
            continue

        link_sets.append({
            "set": str(key),
            "notes": "Objects linked when they share the same value for '{}'".format(key),
            "links": key_links,
        })

    # Keep collisions as a separate dedicated set (already sparse).
    link_sets.append({
        "set": "collisions",
        "notes": "Objects linked by mesh clash / proximity detection.",
        "links": list(collision_links or []),
    })

    return link_sets


# ---------------------------------------------------------------------------
# Collision-based connections (delegated)
# ---------------------------------------------------------------------------

def build_collision_links(doc):
    """Backward-compatible wrapper delegating to ``collision_utils``."""
    return collision_utils.build_collision_links(doc)


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
    collision_links = collision_utils.build_collision_links(doc)
    _log("[setup_graph] Created {} collision-based link(s).".format(len(collision_links)))

    all_links = attr_links + collision_links
    link_sets = _build_link_sets(kv_index, collision_links)

    # 4. Build & store a NetworkX graph in sc.sticky
    G = _build_networkx_graph(nodes, all_links)

    # 5. Assemble CreateGraphPayload
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


def update_graph_attributes_only(graph_name=None):
    """
    Lightweight graph update: re-scan node metadata and attribute links
    but **reuse existing collision links** from the previous graph.

    This is much faster than ``setup_graph()`` because it skips the
    expensive mesh clash detection pass.  Use when only object attributes
    (name, layer, user strings, etc.) have changed.

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
        _log("[update_attrs] No active Rhino document.")
        return None

    if graph_name is None:
        graph_name = doc.Name or "Untitled Rhino Graph"

    _log("[update_attrs] Re-scanning attributes for '{}'...".format(graph_name))

    # 1. Collect nodes + shared-attribute index (cheap)
    nodes, kv_index = _collect_nodes_and_attrs(doc)
    _log("[update_attrs] Found {} object(s).".format(len(nodes)))

    # 2. Build links from shared key-value pairs (cheap)
    attr_links = _build_attribute_links(kv_index)
    _log("[update_attrs] Created {} attribute-based link(s).".format(len(attr_links)))

    # 3. Reuse existing collision links from the previous graph
    existing_graph = sc.sticky.get(STICKY_KEY)
    collision_links = []
    if existing_graph is not None:
        for u, v, data in existing_graph.edges(data=True):
            if data.get("name") == "collision":
                collision_links.append({
                    "source": u,
                    "target": v,
                    "name": "collision",
                })
        _log("[update_attrs] Reusing {} existing collision link(s).".format(
            len(collision_links)))
    else:
        _log("[update_attrs] No existing graph — collision links skipped.")

    all_links = attr_links + collision_links
    link_sets = _build_link_sets(kv_index, collision_links)

    # 4. Build & store a NetworkX graph in sc.sticky
    G = _build_networkx_graph(nodes, all_links)

    # 5. Assemble payload & upsert
    payload = {
        "name": graph_name,
        "graph": {
            "nodes": nodes,
            "links": link_sets,
        },
    }

    _log("[update_attrs] Upserting graph via API ({})...".format(
        API_BASE_URL + GRAPH_ENDPOINT))
    try:
        action, response = _upsert_graph(graph_name, payload)
        _log("[update_attrs] API {} graph successfully.".format(action))
        return response
    except Exception as ex:
        _log("[update_attrs] WARNING: Could not reach API – {}".format(ex))
        return None
