#! python3
import Rhino
import rhinoscriptsyntax as rs
import scriptcontext as sc
import os
import json

def perform_mesh_clash_detection():
    # 1. Select all objects
    ids = rs.GetObjects("Select Breps for Mesh Clash detection", rs.filter.polysurface)
    if not ids: return

    # 2. Select Save Folder
    folder = rs.BrowseForFolder(message="Select folder to save the JSON report")
    if not folder: return 
    
    json_path = os.path.join(folder, "Mesh_Clash_Report.json")

    # 3. Setup Mesh Parameters (Low density for speed)
    # We use 'FastRenderMesh' to get a lightweight version for testing
    mesh_params = Rhino.Geometry.MeshingParameters.FastRenderMesh
    
    meshes = []
    valid_ids = []
    
    print("--- Converting Breps to Meshes ---")
    for obj_id in ids:
        brep = rs.coercebrep(obj_id)
        if brep:
            # Create a mesh representation of the Brep
            joined_mesh = Rhino.Geometry.Mesh()
            parts = Rhino.Geometry.Mesh.CreateFromBrep(brep, mesh_params)
            for m in parts: joined_mesh.Append(m)
            
            meshes.append(joined_mesh)
            valid_ids.append(str(obj_id))

    count = len(valid_ids)
    clash_dict = {}
    clash_count = 0

    print("--- Starting Mesh Clash Detection ---")

    # 4. Nested Loop Comparison
    for i in range(count):
        guid_a = valid_ids[i]
        mesh_a = meshes[i]
        
        for j in range(i + 1, count):
            guid_b = valid_ids[j]
            mesh_b = meshes[j]

            # Mesh Clash returns an array of intersection polylines
            # If the length is > 0, they are clashing
            clash_curves = Rhino.Geometry.Intersect.Intersection.MeshMeshAccurate(
                mesh_a, mesh_b, sc.doc.ModelAbsoluteTolerance
            )

            if clash_curves and len(clash_curves) > 0:
                clash_count += 1
                
                # Bi-directional dictionary entry
                if guid_a not in clash_dict: clash_dict[guid_a] = []
                clash_dict[guid_a].append(guid_b)
                
                if guid_b not in clash_dict: clash_dict[guid_b] = []
                clash_dict[guid_b].append(guid_a)

    # 5. Export to JSON
    if clash_dict:
        try:
            with open(json_path, 'w') as f_json:
                json.dump(clash_dict, f_json, indent=4)
            
            print("\nSUCCESS: Found {} clashing mesh pairs.".format(clash_count))
            print("Report saved to: {}".format(json_path))
            
            # Select results
            rs.UnselectAllObjects()
            rs.SelectObjects(clash_dict.keys())
        except Exception as e:
            print("ERROR: Failed to write JSON. {}".format(e))
    else:
        print("No Mesh clashes found.")

    sc.doc.Views.Redraw()

if __name__ == "__main__":
    perform_mesh_clash_detection()