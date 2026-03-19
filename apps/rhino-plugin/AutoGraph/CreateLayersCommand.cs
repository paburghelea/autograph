using Rhino;
using Rhino.Commands;
using Rhino.DocObjects;

public class CreateLayersCommand : Command
{
    public override string EnglishName => "CreateLayers";

    protected override Result RunCommand(RhinoDoc doc, RunMode mode)
    {
        CreateLayer(doc, "A");
        CreateLayer(doc, "A-Walls", "A");
        CreateLayer(doc, "A-Doors", "A");
        CreateLayer(doc, "A-Windows", "A");

        CreateLayer(doc, "Structure");
        CreateLayer(doc, "S-Beams", "Structure");
        CreateLayer(doc, "S-Columns", "Structure");

        RhinoApp.WriteLine("Layer structure created.");
        return Result.Success;
    }

    private void CreateLayer(RhinoDoc doc, string name, string parent = null)
    {
        Layer layer = new Layer();
        layer.Name = name;

        if (parent != null)
        {
            int parentIndex = doc.Layers.Find(parent, true);
            if (parentIndex >= 0)
                layer.ParentLayerId = doc.Layers[parentIndex].Id;
        }

        doc.Layers.Add(layer);
    }
}