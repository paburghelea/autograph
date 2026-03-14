"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { GraphData, GraphNode } from "@/types/graph";
import { useGraphStore } from "@/store/use-graph-store";
import { GitBranchPlusIcon } from "lucide-react";

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

  const { setSelectedNode, metadataStyle, graphData: storeGraphData } =
    useGraphStore();
  // const width = widthProp ?? dimensions.width;
  // const height = heightProp ?? dimensions.height;

  const handleNodeClick = (
    node: { id?: string | number; name?: string; [k: string]: unknown }
  ) => {
    setSelectedNode({
      ...node,
      id: String(node.id ?? ""),
    } as GraphNode);
  };

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

  const getNumericExtent = (attr: string | null) => {
    if (!attr) return null;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const node of normalizedData.nodes) {
      const raw = (node as Record<string, unknown>)[attr];
      const v = typeof raw === "number" ? raw : Number(raw);
      if (Number.isFinite(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
      return null;
    }
    return { min, max };
  };

  const colorExtent = getNumericExtent(metadataStyle.colorAttribute);
  const sizeExtent = getNumericExtent(metadataStyle.sizeAttribute);

  const hexToRgb = (hex: string) => {
    const cleaned = hex.replace("#", "");
    const value =
      cleaned.length === 3
        ? cleaned
            .split("")
            .map((c) => c + c)
            .join("")
        : cleaned;
    const num = parseInt(value, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  };

  const rgbToHex = (r: number, g: number, b: number) =>
    `#${[r, g, b]
      .map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0"))
      .join("")}`;

  const lerpColor = (t: number, start: string, end: string) => {
    const a = hexToRgb(start);
    const b = hexToRgb(end);
    const clamped = Math.max(0, Math.min(1, t));
    return rgbToHex(
      a.r + (b.r - a.r) * clamped,
      a.g + (b.g - a.g) * clamped,
      a.b + (b.b - a.b) * clamped
    );
  };

  if (normalizedData.nodes.length === 0) {
    return (
      <div
        className="flex min-h-0 min-w-0 flex-1 items-center justify-center  gap-4 text-muted-foreground"
      >
        No nodes to display
        <GitBranchPlusIcon className="size-4" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      <div className="absolute right-1 bottom-1 z-20 rounded-lg bg-background p-2 border border-border">
        <div className="mb-1 text-xs font-medium text-muted-foreground">
          Link set
        </div>
        <div className="flex items-center">
          <select
            className="h-8 rounded-md border bg-background px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={activeLinkSetIndex === null ? "all" : String(activeLinkSetIndex)}
            onChange={(e) => {
              const value = e.target.value;
              setActiveLinkSetIndex(value === "all" ? null : Number(value));
            }}
          >
            <option value="all">All</option>
            {linkSets.map((set, index) => (
              <option key={set.set ?? index} value={index} title={set.notes}>
                {set.set}
              </option>
            ))}
          </select>
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
        nodeColor={
          ((
            n: { [others: string]: any; id?: string | number }
          ): string => {
            const baseColor =
              (n.color as string | undefined) ??
              (storeGraphData as GraphData | undefined)?.nodes?.find(
                (original) => original.id === n.id
              )?.color ??
              "#3b82f6";

            if (!metadataStyle.colorAttribute || !colorExtent) {
              return baseColor as string;
            }

            const raw = n[metadataStyle.colorAttribute];
            const value = typeof raw === "number" ? raw : Number(raw);
            if (!Number.isFinite(value)) return baseColor as string;

            const t =
              (value - colorExtent.min) / (colorExtent.max - colorExtent.min);
            return lerpColor(t, metadataStyle.colorMin, metadataStyle.colorMax);
          }) as any
        }
        nodeVal={
          ((
            n: { [others: string]: any }
          ): number => {
            if (!metadataStyle.sizeAttribute || !sizeExtent) return 1;
            const raw = n[metadataStyle.sizeAttribute];
            const value = typeof raw === "number" ? raw : Number(raw);
            if (!Number.isFinite(value)) return 1;
            const t =
              (value - sizeExtent.min) / (sizeExtent.max - sizeExtent.min);
            const size =
              metadataStyle.sizeMin +
              t * (metadataStyle.sizeMax - metadataStyle.sizeMin);
            return Number.isFinite(size) ? size : 1;
          }) as any
        }
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
