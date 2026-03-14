using Rhino;
using Rhino.Commands;

public class CreateGraphCommand : Command
{
    public override string EnglishName => "CreateGraph";

    protected override Result RunCommand(RhinoDoc doc, RunMode mode)
    {
        RhinoApp.WriteLine(
            "[CreateGraph] Command is available. Hook your graph-build workflow here."
        );
        return Result.Success;
    }
}
