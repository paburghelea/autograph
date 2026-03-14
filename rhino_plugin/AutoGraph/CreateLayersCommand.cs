using Rhino;
using Rhino.Commands;
using Rhino.DocObjects;

public class CreateLayersCommand : Command
{
    public override string EnglishName => "CreateLayers";

    protected override Result RunCommand(RhinoDoc doc, RunMode mode)
    {
        string[] layers =
        {
            // BuildingElement::Function::Material 
            "Curtainwall",
            "Curtainwall::Facade",
            "Curtainwall::Facade::metal",
            "Curtainwall::Facade::glass",

            "Wall",
            "Wall::nonloadbearing",
            "Wall::nonloadbearing::timber",
            "Wall::core",
            "Wall::core::steel",
            "Wall::core::concrete",

            "Stair",
            "Stair::core",
            "Stair::core::concrete",

            "Floor",
            "Floor::nonloadbearing",
            "Floor::nonloadbearing::concrete",
            "Floor::core",
            "Floor::core::concrete",

            "Foundation",
            "Foundation::loadbearing",
            "Foundation::loadbearing::concrete",

            "Ceiling",
            "Ceiling::Primary",
            "Ceiling::Primary::_concrete",
            "Ceiling::Primary::concrete",

            "Column",
            "Column::loadbearing",
            "Column::loadbearing::column"
        };

        foreach (string layerPath in layers)
        {
            CreateLayerFromPath(doc, layerPath);
        }

        RhinoApp.WriteLine("Layer structure created.");
        return Result.Success;
    }

    private void CreateLayerFromPath(RhinoDoc doc, string fullPath)
    {
        // If layer already exists, skip
        if (doc.Layers.FindByFullPath(fullPath, -1) >= 0)
            return;

        string[] parts = fullPath.Split(new string[] { "::" }, System.StringSplitOptions.None);

        string currentPath = "";
        Layer parentLayer = null;

        for (int i = 0; i < parts.Length; i++)
        {
            currentPath = (i == 0) ? parts[i] : currentPath + "::" + parts[i];

            int index = doc.Layers.FindByFullPath(currentPath, -1);
            if (index >= 0)
            {
                parentLayer = doc.Layers[index];
                continue;
            }

            Layer newLayer = new Layer();
            newLayer.Name = parts[i];

            if (parentLayer != null)
                newLayer.ParentLayerId = parentLayer.Id;

            int newIndex = doc.Layers.Add(newLayer);
            parentLayer = doc.Layers[newIndex];
        }
    }
}
