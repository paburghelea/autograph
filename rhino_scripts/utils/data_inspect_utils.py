# -*- coding: utf-8 -*-
"""
Data inspect utilities for Rhino: fetch graph by name from GraphHopper API,
inspect objects by selection, show collision links (blue lines), color neighbors red,
and display metadata in a text dot.
"""

import json
try:
    import urllib.request as _urllib_request
except Exception:
    import urllib2 as _urllib_request

import Rhino
import rhinoscriptsyntax as rs

try:
    from . import config
except Exception:
    try:
        import utils.config as config
    except Exception:
        import config

try:
    import System.Drawing
except ImportError:
    System = None

# Layer for metadata text dots
LAYER_NAME = "Graph_Metadata_Inspector"

# API from config
API_BASE_URL = getattr(config, "API_BASE_URL", "https://graphhopper.vercel.app")
GRAPH_ENDPOINT = getattr(config, "GRAPH_ENDPOINT", "/api/graphs")


def fetch_graph_by_name(graph_name):
    """Fetch graph data by name from the webapp. Returns graph dict (nodes, links) or None."""
    url_list = API_BASE_URL.rstrip("/") + GRAPH_ENDPOINT
    try:
        resp = _urllib_request.urlopen(url_list, timeout=15)
        graphs_data = json.loads(resp.read().decode("utf-8"))
        try:
            resp.close()
        except Exception:
            pass
        candidates = graphs_data if isinstance(graphs_data, list) else graphs_data.get("graphs", [])
        graph_id = next(
            (g.get("id") or g.get("_id") for g in candidates if isinstance(g, dict) and g.get("name") == graph_name),
            None,
        )
        if not graph_id:
            return None
        url_detail = API_BASE_URL.rstrip("/") + GRAPH_ENDPOINT.rstrip("/") + "/" + str(graph_id)
        resp = _urllib_request.urlopen(url_detail, timeout=15)
        file_data = json.loads(resp.read().decode("utf-8"))
        try:
            resp.close()
        except Exception:
            pass
        return file_data.get("graph") if isinstance(file_data, dict) and "graph" in file_data else file_data
    except Exception:
        return None


def get_bbox_center(obj_id):
    """Return the center point of the object's bounding box, or None."""
    bbox = rs.BoundingBox(obj_id)
    if not bbox or len(bbox) < 7:
        return None
    return (bbox[0] + bbox[6]) / 2


def visualize_collision_conduit(data, target_guid, start_pt, conduit, modified_list):
    """
    Draw blue collision lines from start_pt to collision neighbors and color neighbor objects red.
    Returns the number of collision links drawn.
    """
    if System is None:
        return 0
    target_guid_clean = target_guid.lower().strip()
    line_thickness = 8
    line_color = System.Drawing.Color.Blue

    root_links = data.get("links", [])
    collision_set = next((item for item in root_links if isinstance(item, dict) and item.get("set") == "collisions"), None)
    if not collision_set:
        return 0

    actual_links = collision_set.get("links", [])
    count = 0

    for link in actual_links:
        source = str(link.get("source", "")).lower().strip()
        target = str(link.get("target", "")).lower().strip()
        neighbor_guid = None
        if source == target_guid_clean:
            neighbor_guid = target
        elif target == target_guid_clean:
            neighbor_guid = source
        if not neighbor_guid:
            continue
        neighbor_obj = rs.coerceguid(neighbor_guid)
        if neighbor_obj and rs.IsObject(neighbor_obj):
            end_pt = get_bbox_center(neighbor_obj)
            if end_pt:
                geom_line = Rhino.Geometry.Line(start_pt, end_pt)
                conduit.AddLine(geom_line, line_color, line_thickness)
                rs.ObjectColor(neighbor_obj, [255, 0, 0])
                modified_list.append(neighbor_obj)
                count += 1
    return count


def update_metadata_dot(data, target_guid, center_pt, collision_count):
    """Create or replace a text dot on LAYER_NAME with node metadata."""
    nodes = data.get("nodes", [])
    target_guid_clean = target_guid.lower().strip()
    target_node = next(
        (n for n in nodes if isinstance(n, dict) and str(n.get("id", "")).lower().strip() == target_guid_clean),
        None,
    )
    if not target_node:
        return
    if not rs.IsLayer(LAYER_NAME):
        rs.AddLayer(LAYER_NAME, color=[0, 255, 150])
    existing = rs.ObjectsByLayer(LAYER_NAME)
    if existing:
        rs.DeleteObjects(existing)
    node_id_str = str(target_node.get("id", ""))
    id_display = (node_id_str[:30] + "...") if len(node_id_str) > 30 else node_id_str
    metadata_label = (
        "ID: {}\nCOLLISIONS: {}\n────────────────\n"
        "ELEMENT: {}\nMATERIAL: {}\nROLE: {}\n"
        "VOLUME: {:.4f}\nAREA: {:.4f}\nLAYER: {}"
    ).format(
        id_display,
        collision_count,
        target_node.get("Building Element", "N/A"),
        target_node.get("Material System", "N/A"),
        target_node.get("Functional Role", "N/A"),
        float(target_node.get("volume", 0)),
        float(target_node.get("surfaceArea", 0)),
        target_node.get("layer", "N/A"),
    )
    dot_id = rs.AddTextDot(metadata_label, center_pt)
    rs.ObjectLayer(dot_id, LAYER_NAME)


def run_inspect(graph_name):
    """
    Run the data inspector: fetch graph by name, then loop on object selection.
    For each selected object, show collision links (blue), color neighbors red, and show metadata dot.
    """
    print("Connecting to GraphHopper...")
    data = fetch_graph_by_name(graph_name)
    if not data:
        print("Graph not found: {!r}".format(graph_name))
        return

    conduit = Rhino.Display.CustomDisplay(True)
    modified_objects = []

    try:
        while True:
            target_obj = rs.GetObject(
                "Select object (Esc to exit)",
                rs.filter.polysurface | rs.filter.mesh | rs.filter.extrusion,
            )

            # Reset previously modified objects and clear conduit
            for obj_id in modified_objects:
                if rs.IsObject(obj_id):
                    rs.ObjectColor(obj_id, rs.LayerColor(rs.ObjectLayer(obj_id)))
            conduit.Clear()
            modified_objects = []

            if not target_obj:
                break

            rs.ObjectColor(target_obj, [0, 0, 255])
            modified_objects.append(target_obj)

            guid = str(target_obj)
            center = get_bbox_center(target_obj)

            if center:
                count = visualize_collision_conduit(data, guid, center, conduit, modified_objects)
                update_metadata_dot(data, guid, center, count)
                Rhino.RhinoDoc.ActiveDoc.Views.Redraw()
                print("Update complete: {} collisions found.".format(count))
    finally:
        for obj_id in modified_objects:
            if rs.IsObject(obj_id):
                rs.ObjectColor(obj_id, rs.LayerColor(rs.ObjectLayer(obj_id)))
        conduit.Enabled = False
        conduit.Dispose()
        print("Inspector deactivated and colors reset.")
