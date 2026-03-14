using Rhino;
using Rhino.Commands;

public class InspectCollisionCommand : Command
{
    public override string EnglishName => "InspectCollision";

    protected override Result RunCommand(RhinoDoc doc, RunMode mode)
    {
        return PythonScriptCommandUtils.RunScriptFromRepo("rhino_scripts/run_data_inspect_rhino.py");
    }
}
