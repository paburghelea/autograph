"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { GraphData, GraphNode } from "@/types/graph";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
});

interface GraphViewerProps {
  graphData: GraphData;
  width?: number;
  height?: number;
  onNodeClick?: (node: GraphNode) => void;
}

export function GraphViewer({
  graphData,
  width: widthProp,
  height: heightProp,
  onNodeClick,
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

  const width = widthProp ?? dimensions.width;
  const height = heightProp ?? dimensions.height;

  const handleNodeClick = useCallback(
    (node: { id?: string | number; name?: string; [k: string]: unknown }) => {
      onNodeClick?.({
        ...node,
        id: String(node.id ?? ""),
      } as GraphNode);
    },
    [onNodeClick]
  );

  const handleNodeHover = useCallback((node: { id?: string | number; name?: string; [k: string]: unknown } | null) => {
    setHoverNode(node ? { ...node, id: String(node.id ?? "") } as GraphNode : null);
  }, []);

  // Ensure nodes have 'id' and optional 'name' for 3d-force-graph
  const normalizedData = {
    nodes: graphData.nodes.map((n) => ({
      ...n,
      id: n.id,
      name: n.name ?? n.id,
    })),
    links: graphData.links.map((l) => ({
      ...l,
      source: l.source,
      target: l.target,
    })),
  };

  if (normalizedData.nodes.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex min-h-0 min-w-0 flex-1 items-center justify-center rounded-lg border border-border bg-muted/50 text-muted-foreground"
      >
        No nodes to display. Add graph data or load a saved graph.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden ">
      <ForceGraph3D
        graphData={normalizedData}
        // width={width}
        // height={height}
        cooldownTicks={0}
        backgroundColor="rgba(0, 0, 0, 0)"
        // nodeLabel={(node) => {
        //   const n = node as GraphNode & { x?: number; y?: number; z?: number };
        //   const label = n.name ?? n.id;
        //   const attrs = Object.entries(n)
        //     .filter(([k]) => !["id", "name", "x", "y", "z", "vx", "vy", "vz", "fx", "fy", "fz"].includes(k))
        //     .map(([k, v]) => `${k}: ${String(v)}`)
        //     .join("\n");
        //   return attrs ? `${label}\n${attrs}` : label;
        // }}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
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
