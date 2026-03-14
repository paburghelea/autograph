#! python3
"""
Standalone Mesh Clash Detection
================================
Runs clash detection on scene objects and can export results.

This module also exposes ``build_collision_links(doc)`` so the main
graph setup can import and reuse the same collision implementation.

Can also be run directly to export a JSON report to disk.
"""

import Rhino
import rhinoscriptsyntax as rs
import scriptcontext as sc
import os
import json

try:
    # Preferred when imported as utils.collision_utils
    from . import config
except Exception:
    try:
        # Fallback when utils is available on sys.path
        import utils.config as config
    except Exception:
        # Last-resort fallback
        import config

_log = lambda msg: Rhino.RhinoApp.WriteLine(str(msg))
CLASH_DISTANCE = getattr(config, "CLASH_DISTANCE", 0.01)


def _mesh_object(rhino_obj, mesh_params):
    """Return a single mesh for a Rhino object, or None."""
    geo = rhino_obj.Geometry
    if geo is None:
        return None

    otype = geo.ObjectType

    if otype == Rhino.DocObjects.ObjectType.Mesh:
        return geo

    if otype == Rhino.DocObjects.ObjectType.Brep:
        parts = Rhino.Geometry.Mesh.CreateFromBrep(geo, mesh_params)
        if parts:
            joined = Rhino.Geometry.Mesh()
            for m in parts:
                joined.Append(m)
            return joined
        return None

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

    if otype == Rhino.DocObjects.ObjectType.SubD:
        if hasattr(geo, "ToMesh"):
            mesh = geo.ToMesh(Rhino.Geometry.MeshingParameters.Minimal)
            if mesh:
                return mesh
        return None

    return None


def _mesh_all_objects(doc):
    """Mesh all meshable objects in the document."""
    mesh_params = Rhino.Geometry.MeshingParameters.Minimal
    guid_strs, meshes = [], []

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
    """Approximate minimum distance between two meshes."""
    best = float("inf")

    for src, tgt in ((mesh_a, mesh_b), (mesh_b, mesh_a)):
        verts = src.Vertices
        vert_count = verts.Count
        if vert_count == 0:
            continue

        step = max(1, vert_count // max_samples)
        for idx in range(0, vert_count, step):
            pt = Rhino.Geometry.Point3d(verts[idx])
            closest = tgt.ClosestPoint(pt)
            if closest is None or closest == Rhino.Geometry.Point3d.Unset:
                continue
            d = pt.DistanceTo(closest)
            if d < best:
                best = d
                if best == 0.0:
                    return 0.0

    return best


def _clash_via_rtree(meshes, guid_strs, tolerance):
    """RTree broad-phase + MeshMeshFast/distance narrow-phase."""
    count = len(meshes)
    if count < 2:
        return set()

    bboxes = []
    for m in meshes:
        bb = m.GetBoundingBox(False)
        if tolerance > 0:
            bb.Inflate(tolerance)
        bboxes.append(bb)

    tree = Rhino.Geometry.RTree()
    for i, bb in enumerate(bboxes):
        tree.Insert(bb, i)

    pairs = set()
    Intersection = Rhino.Geometry.Intersect.Intersection

    for i in range(count):
        candidates = []

        def _make_cb(idx, cands):
            def _cb(sender, e):
                if e.Id > idx:
                    cands.append(e.Id)
            return _cb

        tree.Search(bboxes[i], _make_cb(i, candidates))

        for j in candidates:
            hit = False

            lines = Intersection.MeshMeshFast(meshes[i], meshes[j])
            if lines and len(lines) > 0:
                hit = True

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
    """Return GraphLink-style collision edges for the given document."""
    guid_strs, meshes = _mesh_all_objects(doc)
    count = len(meshes)
    if count < 2:
        _log("[collision] < 2 meshable objects — skipping clash detection.")
        return []

    _log("[collision] Meshed {} objects. Running clash detection (distance={})...".format(
        count, CLASH_DISTANCE))

    pairs = _clash_via_rtree(meshes, guid_strs, CLASH_DISTANCE)
    _log("[collision] Found {} colliding pair(s).".format(len(pairs)))

    links = []
    for src, tgt in pairs:
        links.append({
            "source": src,
            "target": tgt,
            "name": "collision",
        })
    return links


def perform_mesh_clash_detection(export_json=True):
    """
    Run mesh clash detection using ``build_collision_links``.

    Parameters
    ----------
    export_json : bool
        If True, prompt the user for a save folder and write a JSON report.
    """
    doc = Rhino.RhinoDoc.ActiveDoc
    if doc is None:
        print("No active Rhino document.")
        return

    # --- Run the shared clash detection ------------------------------------
    collision_links = build_collision_links(doc)

    if not collision_links:
        print("No mesh clashes found.")
        return

    # Build a bi-directional adjacency dict for reporting / selection
    clash_dict = {}
    for link in collision_links:
        src, tgt = link["source"], link["target"]
        clash_dict.setdefault(src, []).append(tgt)
        clash_dict.setdefault(tgt, []).append(src)

    clash_pair_count = len(collision_links)
    print("\nSUCCESS: Found {} clashing mesh pair(s).".format(clash_pair_count))

    # --- Optional JSON export ----------------------------------------------
    if export_json:
        folder = rs.BrowseForFolder(message="Select folder to save the JSON report")
        if folder:
            json_path = os.path.join(folder, "Mesh_Clash_Report.json")
            try:
                with open(json_path, "w") as f:
                    json.dump(clash_dict, f, indent=4)
                print("Report saved to: {}".format(json_path))
            except Exception as e:
                print("ERROR: Failed to write JSON. {}".format(e))

    # --- Select clashing objects in the viewport ---------------------------
    try:
        rs.UnselectAllObjects()
        rs.SelectObjects(list(clash_dict.keys()))
    except Exception:
        pass

    sc.doc.Views.Redraw()


if __name__ == "__main__":
    perform_mesh_clash_detection()