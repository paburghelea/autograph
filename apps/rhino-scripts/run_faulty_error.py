"""
Faulty geometry display: fetch graph by current document name and place
error dots at objects marked as faulty in the graph.

Usage:
    Run this script in Rhino's Python editor (EditPythonScript).
"""
import os
import sys

import rhinoscriptsyntax as rs

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
if THIS_DIR and THIS_DIR not in sys.path:
    sys.path.insert(0, THIS_DIR)

UTILS_DIR = os.path.join(THIS_DIR, "utils")
if UTILS_DIR and UTILS_DIR not in sys.path:
    sys.path.insert(0, UTILS_DIR)

import faulty_error_utils

# Graph name = current Rhino document name (e.g. "260314_Attribute Model.3dm")
GRAPH_NAME = rs.DocumentName()

if __name__ == "__main__":
    faulty_error_utils.run_faulty_display(GRAPH_NAME)
