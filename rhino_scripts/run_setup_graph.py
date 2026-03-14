# -*- coding: utf-8 -*-
"""
Rhino Scene -> Graph Setup
=========================
Iterates over every object in the active Rhino document, collects
user-string attributes, builds a graph (nodes = GUIDs, links =
shared key-value pairs), and pushes it to the GraphHopper API.

Usage:
    Run this script in Rhino's Python editor (EditPythonScript).
"""
#! python3
# venv: auto-graph
# r: networkx, numpy

import os
import sys

THIS_DIR = os.path.dirname(__file__)
if THIS_DIR and THIS_DIR not in sys.path:
    sys.path.insert(0, THIS_DIR)

UTILS_DIR = os.path.join(THIS_DIR, "utils")
if UTILS_DIR and UTILS_DIR not in sys.path:
    sys.path.insert(0, UTILS_DIR)

import setup_utils

# Always run the setup when this script is executed from Rhino.
setup_utils.setup_graph()
