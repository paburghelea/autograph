"""Runtime config for Rhino graph setup scripts."""

# API base address provided by the web app deployment
API_BASE_URL = "https://graphhopper.vercel.app"

# Graph API endpoints
GRAPH_ENDPOINT = "/api/graphs"

# Clash detection
# Distance tolerance for mesh clash detection (model units).
# Objects within this distance are considered colliding.
# 0.0 = pure intersection only; > 0 = near-miss / touching detection.
CLASH_DISTANCE = 1.0

# Rhino sticky keys
NX_GRAPH_STICKY_KEY = "_graphhopper_nx_graph"
GRAPH_ID_STICKY_KEY = "_graphhopper_api_graph_id"
