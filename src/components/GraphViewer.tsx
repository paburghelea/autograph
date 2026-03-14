"use client";

import { useCallback, useState } from "react";
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
  width,
  height,
  onNodeClick,
}: GraphViewerProps) {
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);

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
        className="flex items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        style={{ width: width ?? "100%", height: height ?? 400 }}
      >
        No nodes to display. Add graph data or load a saved graph.
      </div>
    );
  }

  return (
    <div className="relative rounded-lg border border-zinc-200 bg-zinc-900 dark:border-zinc-700">
      <ForceGraph3D
        graphData={normalizedData}
        width={width}
        height={height ?? 500}
        backgroundColor="#0a0a0a"
        nodeLabel={(node) => {
          const n = node as GraphNode & { x?: number; y?: number; z?: number };
          const label = n.name ?? n.id;
          const attrs = Object.entries(n)
            .filter(([k]) => !["id", "name", "x", "y", "z", "vx", "vy", "vz", "fx", "fy", "fz"].includes(k))
            .map(([k, v]) => `${k}: ${String(v)}`)
            .join("\n");
          return attrs ? `${label}\n${attrs}` : label;
        }}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        nodeColor={() => "#3b82f6"}
        linkColor={() => "#64748b"}
      />
      {hoverNode && (
        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 font-mono text-xs text-white">
          {hoverNode.name ?? hoverNode.id}
        </div>
      )}
    </div>
  );
}
