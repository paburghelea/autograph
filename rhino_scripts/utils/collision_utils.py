#! python3
"""
Standalone Mesh Clash Detection
================================
Runs clash detection on all (or selected) Breps in the scene and
prints the results.  The heavy lifting is delegated to
``setup_utils.build_collision_links`` so both this script and the
main graph-setup pipeline share the same optimised code path.

Can also be run directly to export a JSON report to disk.
"""

import Rhino
import rhinoscriptsyntax as rs
import scriptcontext as sc
import os
import json

try:
    import setup_utils
except Exception:
    try:
        from utils import setup_utils
    except Exception:
        from . import setup_utils


def perform_mesh_clash_detection(export_json=True):
    """
    Run mesh clash detection using the shared ``build_collision_links``
    implementation (RTree broad-phase + MeshMeshFast / MeshClash).

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
    collision_links = setup_utils.build_collision_links(doc)

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