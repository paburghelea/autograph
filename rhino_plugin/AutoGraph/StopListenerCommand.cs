using Rhino;
using Rhino.Commands;

public class StopListenerCommand : Command
{
    public override string EnglishName => "StopListener";

    protected override Result RunCommand(RhinoDoc doc, RunMode mode)
    {
        return PythonScriptCommandUtils.RunScriptFromRepo("rhino_scripts/run_stop_listener.py");
    }
}
