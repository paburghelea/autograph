using Rhino;
using Rhino.Commands;

public class CreateGraphCommand : Command
{
    public override string EnglishName => "CreateGraph";

    protected override Result RunCommand(RhinoDoc doc, RunMode mode)
    {
        return PythonScriptCommandUtils.RunScriptFromRepo("rhino_scripts/run_setup_graph.py");
    }
}
