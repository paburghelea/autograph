"use client";

import { useEffect, useRef } from "react";
import { FileStack, Download, Trash2 } from "lucide-react";
import { GraphViewer } from "@/components/GraphViewer";
import { NodeDetailPanel } from "@/components/NodeDetailPanel";
import { useGraphStore } from "@/store/use-graph-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default function Home() {
  const {
    files,
    currentFile,
    graphData,
    selectedNode,
    newGraphName,
    rhinoFile,
    loading,
    saving,
    setNewGraphName,
    setRhinoFile,
    setSelectedNode,
    loadFile,
    fetchFiles,
    save,
    saveAsNew,
    deleteFile,
    downloadRhino,
  } = useGraphStore();

  const rhinoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <span className="font-semibold text-sidebar-foreground">
            GraphHopper
          </span>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Saved graphs</SidebarGroupLabel>
            <SidebarGroupContent>
              {loading ? (
                <p className="px-2 py-4 text-sm text-muted-foreground">
                  Loading…
                </p>
              ) : files.length === 0 ? (
                <p className="px-2 py-4 text-sm text-muted-foreground">
                  No graphs yet.
                </p>
              ) : (
                <SidebarMenu>
                  {files.map((file) => (
                    <SidebarMenuItem key={file.id}>
                      <SidebarMenuButton
                        isActive={currentFile?.id === file.id}
                        onClick={() => loadFile(file)}
                      >
                        <FileStack className="size-4 shrink-0" />
                        <span className="truncate">{file.name}</span>
                      </SidebarMenuButton>
                      <SidebarMenuAction
                        onClick={() => deleteFile(file.id)}
                        showOnHover
                        aria-label="Delete graph"
                      >
                        <Trash2 className="size-4" />
                      </SidebarMenuAction>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-background px-4">
          <SidebarTrigger />
          <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
            <Input
              type="text"
              placeholder="Graph name"
              value={newGraphName || (currentFile?.name ?? "")}
              onChange={(e) => setNewGraphName(e.target.value)}
              className="h-8 w-48"
            />
            <>
              <input
                ref={rhinoInputRef}
                type="file"
                accept=".3dm"
                className="hidden"
                onChange={(e) => setRhinoFile(e.target.files?.[0] ?? null)}
                aria-hidden
              />
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => rhinoInputRef.current?.click()}
              >
                {rhinoFile ? rhinoFile.name : currentFile?.rhinoFileName ?? "Rhino .3dm"}
              </Button>
            </>
            {currentFile?.rhinoFileBase64 && (
              <Button
                variant="outline"
                size="sm"
                onClick={downloadRhino}
                aria-label="Download Rhino file"
              >
                <Download className="size-4 shrink-0" />
                Download Rhino
              </Button>
            )}
            <Button
              size="sm"
              onClick={save}
              disabled={!currentFile || saving}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={saveAsNew}
              disabled={saving}
            >
              Save as new
            </Button>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4">
          <main className="relative min-h-0 flex-1">
            <GraphViewer
              graphData={graphData}
              height={600}
              onNodeClick={setSelectedNode}
            />
            <NodeDetailPanel
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
            />
          </main>

          <footer className="shrink-0 border-t border-border py-2 text-center text-sm text-muted-foreground">
            POST graph data to{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
              /api/data
            </code>{" "}
            or{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
              /api/graphs
            </code>{" "}
            to load in the viewer.
          </footer>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
