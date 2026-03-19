"""
Rhino Object Change Listener
=============================
Listens for geometry and attribute changes on Rhino objects
and prints details about what changed.

Usage:
    Run this script in Rhino's Python editor (EditPythonScript).
    To stop listening, run: stop_listening()
"""
#! python3
# venv: auto-graph
# r: networkx, numpy

import os
import sys


THIS_DIR = os.path.dirname(__file__)
if THIS_DIR and THIS_DIR not in sys.path:
    sys.path.insert(0, THIS_DIR)

import utils.listener_utils as listener_utils

# Always start when this script is executed from Rhino.
listener_utils.start_listening()