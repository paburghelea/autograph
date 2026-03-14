using Rhino;
using Rhino.Commands;

public class StartListenerCommand : Command
{
    public override string EnglishName => "StartListener";

    protected override Result RunCommand(RhinoDoc doc, RunMode mode)
    {
        return PythonScriptCommandUtils.RunScriptFromRepo("rhino_scripts/run_start_listener.py");
    }
}
