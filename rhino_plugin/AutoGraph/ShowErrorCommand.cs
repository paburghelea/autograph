using Rhino;
using Rhino.Commands;

public class ShowErrorCommand : Command
{
    public override string EnglishName => "ShowError";

    protected override Result RunCommand(RhinoDoc doc, RunMode mode)
    {
        return PythonScriptCommandUtils.RunScriptFromRepo("rhino_scripts/run_faulty_error.py");
    }
}
