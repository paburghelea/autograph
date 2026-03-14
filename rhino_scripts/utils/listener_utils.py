import threading
import Rhino
import scriptcontext as sc

try:
    from . import setup_utils
except Exception:
    try:
        import utils.setup_utils as setup_utils
    except Exception:
        import setup_utils

_log = lambda msg: Rhino.RhinoApp.WriteLine(str(msg))
_pt = lambda p: "({:.4f}, {:.4f}, {:.4f})".format(p.X, p.Y, p.Z)

# ---------------------------------------------------------------------------
# Debounced graph rebuild
# ---------------------------------------------------------------------------
_DEBOUNCE_SECONDS = 1.0          # wait for rapid changes to settle
_rebuild_timer = None            # type: threading.Timer | None
_rebuild_lock = threading.Lock()


def _schedule_graph_rebuild():
    """Schedule a full graph rebuild after a short debounce window."""
    global _rebuild_timer
    with _rebuild_lock:
        if _rebuild_timer is not None:
            _rebuild_timer.cancel()
        _rebuild_timer = threading.Timer(_DEBOUNCE_SECONDS, _do_graph_rebuild)
        _rebuild_timer.daemon = True
        _rebuild_timer.start()


def _do_graph_rebuild():
    """Run the full graph rebuild and push to API."""
    global _rebuild_timer
    with _rebuild_lock:
        _rebuild_timer = None
    try:
        _log("[listener] Change detected — rebuilding graph...")
        setup_utils.setup_graph()
        _log("[listener] Graph rebuild complete.")
    except Exception as ex:
        _log("[listener] ERROR during graph rebuild: {}".format(ex))


# Attribute properties to diff: (label, property_name)
_ATTR_CHECKS = [
    ("Color source", "ColorSource"),
    ("Color", "ObjectColor"),
    ("Material source", "MaterialSource"),
    ("Material index", "MaterialIndex"),
    ("Linetype source", "LinetypeSource"),
    ("Linetype index", "LinetypeIndex"),
    ("Plot color", "PlotColor"),
    ("Visibility", "Visible"),
    ("Wire density", "WireDensity"),
]


def on_replace_object(sender, e):
    """Fired on any object replacement (geometry or attribute change)."""
    old, new = e.OldRhinoObject, e.NewRhinoObject
    if old is None or new is None:
        return

    name = new.Attributes.Name or "(unnamed)"
    _log("\n" + "=" * 60)
    _log("OBJECT CHANGED: {} [{}]".format(name, new.Id))
    _log("=" * 60)

    # --- Geometry ---
    og, ng = old.Geometry, new.Geometry
    geo_changed = False
    if og and ng:
        if og.ObjectType != ng.ObjectType:
            geo_changed = True
            _log("[GEO] Type: {} -> {}".format(og.ObjectType, ng.ObjectType))

        ob, nb = og.GetBoundingBox(True), ng.GetBoundingBox(True)
        if ob.IsValid and nb.IsValid:
            if ob.Min.DistanceTo(nb.Min) > 1e-6 or ob.Max.DistanceTo(nb.Max) > 1e-6:
                geo_changed = True
                _log("[GEO] BBox: {} / {} -> {} / {}".format(_pt(ob.Min), _pt(ob.Max), _pt(nb.Min), _pt(nb.Max)))
                # Detect pure translation
                v = nb.Min - ob.Min
                v2 = nb.Max - ob.Max
                if all(abs(getattr(v, c) - getattr(v2, c)) < 1e-6 for c in "XYZ") and v.Length > 1e-6:
                    _log("[MOVE] Vector {} distance {:.4f}".format(_pt(v), v.Length))

        if not geo_changed and og.GetHashCode() != ng.GetHashCode():
            geo_changed = True
            _log("[GEO] Data changed (hash mismatch)")

    if not geo_changed:
        _log("[GEO] No change")

    # --- Attributes ---
    oa, na = old.Attributes, new.Attributes
    changed = False

    # Name
    on, nn = oa.Name or "", na.Name or ""
    if on != nn:
        changed = True
        _log("[ATTR] Name: '{}' -> '{}'".format(on, nn))

    # Layer
    if oa.LayerIndex != na.LayerIndex:
        changed = True
        doc = Rhino.RhinoDoc.ActiveDoc
        get_lyr = lambda i: doc.Layers[i].FullPath if i < doc.Layers.Count else "?"
        _log("[ATTR] Layer: '{}' -> '{}'".format(get_lyr(oa.LayerIndex), get_lyr(na.LayerIndex)))

    # Simple property diffs
    for label, prop in _ATTR_CHECKS:
        ov, nv = getattr(oa, prop), getattr(na, prop)
        if ov != nv:
            changed = True
            _log("[ATTR] {}: {} -> {}".format(label, ov, nv))

    # Plot weight (float comparison)
    if abs(oa.PlotWeight - na.PlotWeight) > 1e-6:
        changed = True
        _log("[ATTR] Plot weight: {} -> {}".format(oa.PlotWeight, na.PlotWeight))

    # Groups
    og_list, ng_list = list(oa.GetGroupList() or []), list(na.GetGroupList() or [])
    if og_list != ng_list:
        changed = True
        _log("[ATTR] Groups: {} -> {}".format(og_list, ng_list))

    # User strings
    old_ks = set(oa.GetUserStrings().AllKeys) if oa.GetUserStrings() else set()
    new_ks = set(na.GetUserStrings().AllKeys) if na.GetUserStrings() else set()
    for k in new_ks - old_ks:
        changed = True
        _log("[ATTR] User string added: '{}' = '{}'".format(k, na.GetUserString(k)))
    for k in old_ks - new_ks:
        changed = True
        _log("[ATTR] User string removed: '{}'".format(k))
    for k in old_ks & new_ks:
        ov, nv = oa.GetUserString(k), na.GetUserString(k)
        if ov != nv:
            changed = True
            _log("[ATTR] User string '{}': '{}' -> '{}'".format(k, ov, nv))

    if not changed:
        _log("[ATTR] No change")

    # Trigger graph rebuild on any object replacement
    if geo_changed or changed:
        _schedule_graph_rebuild()


def on_add_object(sender, e):
    obj = e.TheObject
    _log("\n[ADD] {} [{}] {}".format(obj.Attributes.Name or "(unnamed)", obj.Id, obj.Geometry.ObjectType))
    _schedule_graph_rebuild()


def on_delete_object(sender, e):
    obj = e.TheObject
    _log("\n[DEL] {} [{}] {}".format(obj.Attributes.Name or "(unnamed)", obj.Id, obj.Geometry.ObjectType))
    _schedule_graph_rebuild()


def on_transform_objects(sender, e):
    """Fired after Move/Rotate/Scale/Mirror transforms."""
    xform = getattr(e, "Transform", None)
    n = getattr(e, "ObjectCount", "?")
    if xform is None:
        _log("\n[TRANSFORM] {} object(s) transformed.".format(n))
        return
    tx, ty, tz = xform.M03, xform.M13, xform.M23
    dist = (tx * tx + ty * ty + tz * tz) ** 0.5
    if dist > 1e-6:
        _log("\n[MOVE] {} obj(s) vector ({:.4f}, {:.4f}, {:.4f}) dist {:.4f}".format(n, tx, ty, tz, dist))
    else:
        _log("\n[TRANSFORM] {} obj(s) transformed (no translation).".format(n))

    _schedule_graph_rebuild()


# --- Event wiring ---

_EVENTS = [
    ("ReplaceRhinoObject", on_replace_object),
    ("AddRhinoObject", on_add_object),
    ("DeleteRhinoObject", on_delete_object),
    ("AfterTransformObjects", on_transform_objects),
]


def start_listening():
    """Subscribe to Rhino document events."""
    stop_listening()
    hooked = []
    for attr, handler in _EVENTS:
        if hasattr(Rhino.RhinoDoc, attr):
            event = getattr(Rhino.RhinoDoc, attr)
            event += handler
            hooked.append(attr)
    sc.sticky["_obj_listener_handlers"] = list(_EVENTS)
    sc.sticky["_obj_listener_active"] = True
    doc = Rhino.RhinoDoc.ActiveDoc
    _log("Listener STARTED on '{}'. Hooked: {}".format(
        doc.Name if doc else "?", ", ".join(hooked)))


def stop_listening():
    """Unsubscribe from Rhino document events."""
    handlers = sc.sticky.pop("_obj_listener_handlers", None)
    if handlers:
        for attr, handler in handlers:
            try:
                if hasattr(Rhino.RhinoDoc, attr):
                    event = getattr(Rhino.RhinoDoc, attr)
                    event -= handler
            except Exception:
                pass
        sc.sticky["_obj_listener_active"] = False
        _log("Listener STOPPED.")