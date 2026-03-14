using System;
using System.IO;
using System.Reflection;
using Rhino;
using Rhino.Commands;

internal static class PythonScriptCommandUtils
{
    internal static Result RunScriptFromRepo(string relativeScriptPath)
    {
        string repoRoot = FindRepoRoot();
        if (string.IsNullOrWhiteSpace(repoRoot))
        {
            RhinoApp.WriteLine("[AutoGraph] Could not locate repository root.");
            return Result.Failure;
        }

        string scriptPath = Path.Combine(
            repoRoot,
            relativeScriptPath.Replace('/', Path.DirectorySeparatorChar)
        );
        bool scriptExists = File.Exists(scriptPath);
        if (!scriptExists)
        {
            RhinoApp.WriteLine("[AutoGraph] Script not found: {0}", scriptPath);
            return Result.Failure;
        }

        Type pythonScriptType = Type.GetType("Rhino.Runtime.PythonScript, RhinoCommon");
        if (pythonScriptType != null)
        {
            MethodInfo createMethod = pythonScriptType.GetMethod(
                "Create",
                BindingFlags.Public | BindingFlags.Static
            );
            object pythonEngine = createMethod != null ? createMethod.Invoke(null, null) : null;
            if (pythonEngine != null)
            {
                MethodInfo executeFileMethod = pythonScriptType.GetMethod(
                    "ExecuteFile",
                    BindingFlags.Public | BindingFlags.Instance,
                    null,
                    new[] { typeof(string) },
                    null
                );
                bool executeFileOk = InvokePythonMethod(
                    pythonEngine,
                    executeFileMethod,
                    new object[] { scriptPath }
                );
                if (executeFileOk)
                    return Result.Success;

                MethodInfo executeScriptMethod = pythonScriptType.GetMethod(
                    "ExecuteScript",
                    BindingFlags.Public | BindingFlags.Instance,
                    null,
                    new[] { typeof(string) },
                    null
                );
                string scriptText = File.ReadAllText(scriptPath);
                bool executeScriptOk = InvokePythonMethod(
                    pythonEngine,
                    executeScriptMethod,
                    new object[] { scriptText }
                );
                if (executeScriptOk)
                    return Result.Success;
            }
        }

        bool pythonProbe = RhinoApp.RunScript("_NoEcho _RunPythonScript", false);
        if (pythonProbe)
        {
            string macro = string.Format("_NoEcho _RunPythonScript \"{0}\"", scriptPath);
            bool started = RhinoApp.RunScript(macro, false);
            if (started)
                return Result.Success;
        }

        RhinoApp.WriteLine("[AutoGraph] Failed to run script: {0}", scriptPath);
        return Result.Failure;
    }

    private static string FindRepoRoot()
    {
        string assemblyPath = Assembly.GetExecutingAssembly().Location;
        if (string.IsNullOrWhiteSpace(assemblyPath))
            return string.Empty;

        DirectoryInfo current = new DirectoryInfo(Path.GetDirectoryName(assemblyPath));
        while (current != null)
        {
            string pluginFolder = Path.Combine(current.FullName, "rhino_plugin");
            string scriptsFolder = Path.Combine(current.FullName, "rhino_scripts");
            if (Directory.Exists(pluginFolder) && Directory.Exists(scriptsFolder))
                return current.FullName;

            current = current.Parent;
        }

        return string.Empty;
    }

    private static bool InvokePythonMethod(object instance, MethodInfo method, object[] args)
    {
        if (instance == null || method == null)
            return false;

        try
        {
            object result = method.Invoke(instance, args);
            if (method.ReturnType == typeof(void))
                return true;
            if (result is bool boolResult)
                return boolResult;
            return result != null;
        }
        catch
        {
            return false;
        }
    }
}
