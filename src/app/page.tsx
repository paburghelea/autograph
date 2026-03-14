"use client";

import { useCallback, useEffect, useState } from "react";
import { GraphViewer } from "@/components/GraphViewer";
import { NodeDetailPanel } from "@/components/NodeDetailPanel";
import type { GraphFile, GraphData, GraphNode } from "@/types/graph";

const EMPTY_GRAPH: GraphData = { nodes: [], links: [] };

export default function Home() {
  const [files, setFiles] = useState<GraphFile[]>([]);
  const [currentFile, setCurrentFile] = useState<GraphFile | null>(null);
  const [graphData, setGraphData] = useState<GraphData>(EMPTY_GRAPH);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newGraphName, setNewGraphName] = useState("");
  const [rhinoFile, setRhinoFile] = useState<File | null>(null);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/graphs");
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const loadFile = useCallback((file: GraphFile) => {
    setCurrentFile(file);
    setGraphData(file.graph);
    setSelectedNode(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!currentFile) return;
    setSaving(true);
    try {
      let rhinoBase64: string | undefined;
      let rhinoFileName: string | undefined;
      if (rhinoFile) {
        const buf = await rhinoFile.arrayBuffer();
        const b64 = btoa(
          new Uint8Array(buf).reduce((acc, byte) => acc + String.fromCharCode(byte), "")
        );
        rhinoBase64 = b64;
        rhinoFileName = rhinoFile.name;
      }
      const res = await fetch(`/api/graphs/${currentFile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newGraphName || currentFile.name,
          graph: graphData,
          ...(rhinoBase64 && { rhinoFileBase64: rhinoBase64, rhinoFileName }),
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentFile(updated);
        setFiles((prev) =>
          prev.map((f) => (f.id === updated.id ? updated : f))
        );
        setRhinoFile(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }, [currentFile, graphData, newGraphName, rhinoFile]);

  const handleSaveAsNew = useCallback(async () => {
    const name = newGraphName.trim() || `Graph ${new Date().toLocaleString()}`;
    setSaving(true);
    try {
      let rhinoBase64: string | undefined;
      let rhinoFileName: string | undefined;
      if (rhinoFile) {
        const buf = await rhinoFile.arrayBuffer();
        const b64 = btoa(
          new Uint8Array(buf).reduce((acc, byte) => acc + String.fromCharCode(byte), "")
        );
        rhinoBase64 = b64;
        rhinoFileName = rhinoFile.name;
      }
      const res = await fetch("/api/graphs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          graph: graphData,
          rhinoFileBase64: rhinoBase64,
          rhinoFileName,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setFiles((prev) => [created, ...prev]);
        setCurrentFile(created);
        setRhinoFile(null);
        setNewGraphName("");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }, [graphData, newGraphName, rhinoFile]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Delete this graph?")) return;
      try {
        const res = await fetch(`/api/graphs/${id}`, { method: "DELETE" });
        if (res.ok) {
          setFiles((prev) => prev.filter((f) => f.id !== id));
          if (currentFile?.id === id) {
            setCurrentFile(null);
            setGraphData(EMPTY_GRAPH);
          }
        }
      } catch (e) {
        console.error(e);
      }
    },
    [currentFile?.id]
  );

  const downloadRhino = useCallback(async () => {
    if (!currentFile?.id || !currentFile.rhinoFileBase64) return;
    try {
      const res = await fetch(`/api/graphs/${currentFile.id}/rhino`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = currentFile.rhinoFileName || "model.3dm";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  }, [currentFile]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            GraphHopper
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Graph name"
              value={newGraphName || (currentFile?.name ?? "")}
              onChange={(e) => setNewGraphName(e.target.value)}
              className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <label className="flex cursor-pointer items-center gap-2 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800">
              <span className="text-zinc-600 dark:text-zinc-400">Rhino .3dm</span>
              <input
                type="file"
                accept=".3dm"
                className="hidden"
                onChange={(e) => setRhinoFile(e.target.files?.[0] ?? null)}
              />
              {rhinoFile ? rhinoFile.name : currentFile?.rhinoFileName ?? "—"}
            </label>
            {currentFile?.rhinoFileBase64 && (
              <button
                type="button"
                onClick={downloadRhino}
                className="rounded border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-sm hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-700 dark:hover:bg-zinc-600"
              >
                Download Rhino
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={!currentFile || saving}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={handleSaveAsNew}
              disabled={saving}
              className="rounded border border-blue-600 bg-white px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 dark:border-blue-500 dark:bg-transparent dark:hover:bg-blue-950"
            >
              Save as new
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 gap-4 p-4">
        <aside className="w-64 shrink-0 overflow-y-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="p-3">
            <h2 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-100">
              Saved graphs
            </h2>
            {loading ? (
              <p className="text-sm text-zinc-500">Loading…</p>
            ) : files.length === 0 ? (
              <p className="text-sm text-zinc-500">No graphs yet.</p>
            ) : (
              <ul className="space-y-1">
                {files.map((file) => (
                  <li key={file.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => loadFile(file)}
                      className={`flex-1 truncate rounded px-2 py-1.5 text-left text-sm ${
                        currentFile?.id === file.id
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {file.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(file.id)}
                      className="rounded p-1 text-zinc-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                      aria-label="Delete"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <main className="relative min-w-0 flex-1">
          <GraphViewer
            graphData={graphData}
            height={600}
            onNodeClick={handleNodeClick}
          />
          <NodeDetailPanel
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
          />
        </main>
      </div>

      <footer className="border-t border-zinc-200 bg-white px-4 py-2 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
        POST graph data to <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">/api/data</code> or{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">/api/graphs</code> to load in the viewer.
      </footer>
    </div>
  );
}
