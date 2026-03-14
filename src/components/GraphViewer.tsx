"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { GraphData, GraphNode } from "@/types/graph";
import { useGraphStore } from "@/store/use-graph-store";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
});

interface GraphViewerProps {
  graphData: GraphData;
  width?: number;
  height?: number;
  // onNodeClick?: (node: GraphNode) => void;
}

export function GraphViewer({
  graphData,
  width: widthProp,
  height: heightProp,
  // onNodeClick,
}: GraphViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setDimensions({ width: Math.floor(width), height: Math.floor(height) });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { setSelectedNode } = useGraphStore();
  // const width = widthProp ?? dimensions.width;
  // const height = heightProp ?? dimensions.height;

  const handleNodeClick = 
    (node: { id?: string | number; name?: string; [k: string]: unknown }) => {
      setSelectedNode({
        ...node,
        id: String(node.id ?? ""),
      } as GraphNode);
    }
 

  const handleNodeHover = useCallback((node: { id?: string | number; name?: string; [k: string]: unknown } | null) => {
    setHoverNode(node ? { ...node, id: String(node.id ?? "") } as GraphNode : null);
  }, []);

  const [activeLinkSetIndex, setActiveLinkSetIndex] = useState<number | null>(
    null
  );

  const linkSets = graphData.links ?? [];
  const activeLinks =
    activeLinkSetIndex === null || !linkSets[activeLinkSetIndex]
      ? linkSets.flatMap((set) => set.links)
      : linkSets[activeLinkSetIndex].links;

  // Ensure nodes have 'id' and optional 'name' for 3d-force-graph
  const normalizedData = {
    nodes: graphData.nodes.map((n) => ({
      ...n,
      id: n.id,
      name: n.name ?? n.id,
    })),
    links: activeLinks.map((l) => ({
      ...l,
      source: l.source,
      target: l.target,
    })),
  };

  if (normalizedData.nodes.length === 0) {
    return (
      <div
        className="flex min-h-0 min-w-0 flex-1 items-center justify-center rounded-lg border border-border bg-muted/50 text-muted-foreground"
      >
        No nodes to display. Add graph data or load a saved graph.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden ">
      <div className="absolute right-1 bottom-1 z-20 rounded-lg bg-background p-2 border border-border">
        <div className="mb-1 text-xs font-medium text-muted-foreground">
          Link set
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className={`rounded px-2 py-1 text-xs ${
              activeLinkSetIndex === null
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            }`}
            onClick={() => setActiveLinkSetIndex(null)}
          >
            All
          </button>
          {linkSets.map((set, index) => (
            <button
              key={set.set ?? index}
              type="button"
              className={`rounded px-2 py-1 text-xs ${
                activeLinkSetIndex === index
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
              onClick={() => setActiveLinkSetIndex(index)}
              title={set.notes}
            >
              {set.set}
            </button>
          ))}
        </div>
      </div>
      <ForceGraph3D
        graphData={normalizedData}
        // width={width}
        // height={height}
        // cooldownTicks={0}
        backgroundColor="rgba(0, 0, 0, 0)"
        onNodeClick={handleNodeClick}
        // onNodeHover={handleNodeHover}
        nodeColor={(n) => n.color ?? "#3b82f6"}
        linkColor={(l) => l.color ?? "#64748b"}
      />
      {/* {hoverNode && (
        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 font-mono text-xs text-white">
          {hoverNode.name ?? hoverNode.id}
        </div>
      )} */}
    </div>
  );
}
