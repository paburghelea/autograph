"""
Faulty geometry display utilities: fetch graph by name from GraphHopper API,
find nodes marked as faulty, and place error text dots at their bbox centers in Rhino.
"""

import json
try:
    import urllib.request as _urllib_request
except Exception:
    import urllib2 as _urllib_request

import rhinoscriptsyntax as rs

try:
    from . import config
except Exception:
    try:
        import utils.config as config
    except Exception:
        import config

# Layer for faulty geometry warning dots
ERROR_LAYER = "Faulty_Geometry_Warnings"

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
    except Exception as e:
        print("Error: {}".format(e))
        return None


def run_faulty_display(graph_name):
    """
    Fetch graph by name, find nodes with faulty=True, and place red error text dots
    at each object's bbox center on layer ERROR_LAYER.
    """
    print("Checking for faulty geometry...")
    data = fetch_graph_by_name(graph_name)
    if not data:
        print("Could not retrieve graph data.")
        return

    nodes = data.get("nodes", [])

    if not rs.IsLayer(ERROR_LAYER):
        rs.AddLayer(ERROR_LAYER, color=[255, 0, 0])

    old_dots = rs.ObjectsByLayer(ERROR_LAYER)
    if old_dots:
        rs.DeleteObjects(old_dots)

    rs.EnableRedraw(False)
    faulty_count = 0

    for node in nodes:
        if node.get("faulty") is not True:
            continue
        guid_str = node.get("id")
        guid = rs.coerceguid(guid_str)
        if not guid or not rs.IsObject(guid):
            continue
        bbox = rs.BoundingBox(guid)
        if not bbox or len(bbox) < 7:
            continue
        center = (bbox[0] + bbox[6]) / 2
        dot_id = rs.AddTextDot("ERROR: FAULTY GEOMETRY", center)
        rs.ObjectLayer(dot_id, ERROR_LAYER)
        rs.ObjectColor(dot_id, [255, 0, 0])
        faulty_count += 1

    rs.EnableRedraw(True)

    if faulty_count > 0:
        print("Found {} faulty objects. Warnings placed on layer: {}".format(faulty_count, ERROR_LAYER))
    else:
        print("No faulty geometry detected in the database.")
