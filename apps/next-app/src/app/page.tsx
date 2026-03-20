"use client";

import { useEffect, useRef, useState } from "react";
import { FileStack, Download, Trash2, FlaskConical, RefreshCw, AlertTriangle } from "lucide-react";
import { GraphViewer } from "@/components/GraphViewer";
import { MetadataStylePanel } from "@/components/MetadataStylePanel";
import { NodeDetailPanel } from "@/components/NodeDetailPanel";
import { useGraphStore } from "@/store/use-graph-store";
import { SAMPLE_DEFINITIONS, type SampleId } from "@/lib/sample-graphs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import Image from "next/image";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/ThemeToggle";

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
    columnFloorTestResult,
    setNewGraphName,
    setRhinoFile,
    setSelectedNode,
    loadFile,
    fetchFiles,
    save,
    saveAsNew,
    deleteFile,
    downloadRhino,
    initWithSample,
    runColumnFloorTest,
    liveUpdateMode,
    setLiveUpdateMode,
    checkForUpdates,
    errorPreviewMode,
    setErrorPreviewMode,
  } = useGraphStore();

  const rhinoInputRef = useRef<HTMLInputElement>(null);
  const [showInitDialog, setShowInitDialog] = useState(false);
  const [selectedSampleId, setSelectedSampleId] = useState<SampleId>(
    SAMPLE_DEFINITIONS[0].id
  );

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // When live update is on and a file is open, poll server and pull if updated_at is newer
  useEffect(() => {
    if (!liveUpdateMode || !currentFile?.id) return;
    const interval = setInterval(() => {
      checkForUpdates();
    }, 2000);
    return () => clearInterval(interval);
  }, [liveUpdateMode, currentFile?.id, checkForUpdates]);

  useEffect(() => {
    if (
      !loading &&
      files.length === 0 &&
      graphData.nodes.length === 0 &&
      graphData.links.length === 0
    ) {
      setShowInitDialog(true);
    }
  }, [loading, files.length, graphData.nodes.length, graphData.links.length]);

  return (
    <SidebarProvider>
      <Sidebar variant="inset">
        <SidebarHeader className="flex flex-row items-center justify-start">
          <Image className="size-6" src="/logo.png" alt="AutoGraph" width={96} height={96} />
          <span className="font-semibold">
            AutoGraph
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
                        <span className="truncate text-xs">{file.name}</span>
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
      <SidebarInset className="relative bg-background rounded-xl border border-border">
        <header className="flex z-10 h-10 shrink-0 items-center gap-4 px-1 ">
          <div className="flex flex-1 items-center gap-1">
            <div className="flex items-center px-2 gap-1">
              <SidebarTrigger />
              <ThemeToggle />
            </div>
            <Button
              variant={liveUpdateMode ? "default" : "outline"}
              size="sm"
              type="button"
              onClick={() => setLiveUpdateMode(!liveUpdateMode)}
              title={
                liveUpdateMode
                  ? "Live update on: graph refreshes when server has newer data"
                  : "Turn on to refresh graph when server data is newer (checks updated_at)"
              }
            >
              <RefreshCw className="size-4 shrink-0" />
              Live {liveUpdateMode ? "on" : "off"}
            </Button>
            <Button
              variant={errorPreviewMode ? "default" : "outline"}
              size="sm"
              type="button"
              onClick={() => setErrorPreviewMode(!errorPreviewMode)}
              title={
                errorPreviewMode
                  ? "Error preview on: faulty nodes red, non-faulty green"
                  : "Show faulty nodes in red and non-faulty in green"
              }
            >
              <AlertTriangle className="size-4 shrink-0" />
              Error preview {errorPreviewMode ? "on" : "off"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setShowInitDialog(true)}
              title="Load one of the built-in sample graphs"
            >
              <FileStack className="size-4 shrink-0" />
              Samples
            </Button>
            {/* <Input
              type="text"
              placeholder="Graph name"
              value={newGraphName || (currentFile?.name ?? "")}
              onChange={(e) => setNewGraphName(e.target.value)}
              className="h-7 w-full"
            /> */}

            <Button
              size="sm"
              variant="default"
              onClick={saveAsNew}
              disabled={saving}
              className="ml-auto"
            >
              Save new
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => runColumnFloorTest()}
            >
              <FlaskConical className="w-3 shrink-0" />
              Run test
            </Button>
            {columnFloorTestResult !== null && (
              <div
                className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 h-7 text-sm"
                title={columnFloorTestResult.message}
              >
                <span className="text-muted-foreground">Score:</span>
                <span
                  className={
                    columnFloorTestResult.score === 100
                      ? "font-semibold text-green-600 dark:text-green-400"
                      : "font-semibold text-amber-600 dark:text-amber-400"
                  }
                >
                  {columnFloorTestResult.score}%
                </span>
                {columnFloorTestResult.totalColumns > 0 && (
                  <span className="text-muted-foreground">
                    ({columnFloorTestResult.passedCount}/{columnFloorTestResult.totalColumns} columns)
                  </span>
                )}
              </div>
            )}
          </div>
        </header>

        <GraphViewer
          graphData={graphData}
        />
        <NodeDetailPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
        />

        <footer className="shrink-0 w-fit absolute text-xs bottom-1 left-1 px-2 rounded-lg border z-10 border-border py-2 text-center text-muted-foreground">
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

        <Dialog open={showInitDialog} onOpenChange={setShowInitDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Load a sample building graph?</DialogTitle>
              <DialogDescription className="text-xs font-sans">
                Replace the current viewer data with one of the built-in sample graphs
                (each includes multiple numeric metrics for the metadata preview).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <select
                value={selectedSampleId}
                onChange={(e) => setSelectedSampleId(e.target.value as SampleId)}
                className="h-10 w-full border bg-background px-3 text-xs rounded-md"
              >
                {SAMPLE_DEFINITIONS.map((s) => (
                  <option className="text-sm font-sans" key={s.id} value={s.id}>
                    {s.name} ({s.complexity})
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground font-sans">{SAMPLE_DEFINITIONS.find((s) => s.id === selectedSampleId)?.description}</p>
            </div>

            <DialogFooter showCloseButton>
              <Button
                className="mr-auto"
                onClick={() => {
                  initWithSample(selectedSampleId);
                  setShowInitDialog(false);
                }}
              >
                Load sample
              </Button>

            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  );
}
