"use client";

import type { JSX } from "react";
import { useMemo } from "react";
import { useGraphStore } from "@/store/use-graph-store";
import {
  getNumericPathsFromNodes,
  getNumericPathsFromLinks,
  getValueByPath,
} from "@/lib/metadata";

export function MetadataStylePanel(): JSX.Element | null {
  const { graphData, metadataStyle, setMetadataStyle } = useGraphStore();

  const { nodeNumericKeys, linkNumericKeys } = useMemo(() => {
    const nodeKeys = getNumericPathsFromNodes(
      graphData.nodes as Record<string, unknown>[]
    );
    const linkKeys = getNumericPathsFromLinks(
      graphData.links ?? []
    );
    return { nodeNumericKeys: nodeKeys, linkNumericKeys: linkKeys };
  }, [graphData.nodes, graphData.links]);

  const hasNumericData = nodeNumericKeys.length > 0 || linkNumericKeys.length > 0;

  if (!graphData.nodes.length || !hasNumericData) {
    return null;
  }

  return (
    <>
      <span className="text-xs text-muted-foreground">
        Metadata
      </span>
      <div className="space-y-3 py-3 text-xs">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[11px] font-medium text-muted-foreground">
              Color by
            </label>
            <select
              className="h-7 flex-1 rounded-md border bg-background px-2 text-[11px]  focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={metadataStyle.colorAttribute ?? ""}
              onChange={(e) =>
                setMetadataStyle({
                  colorAttribute: e.target.value || null,
                })
              }
            >
              <option value="">None</option>
              {nodeNumericKeys.map((key: string) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </div>
    
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-muted-foreground">Min</span>
              <input
                type="color"
                className="h-6 w-10 cursor-pointer rounded border border-border bg-background p-0"
                value={metadataStyle.colorMin}
                onChange={(e) =>
                  setMetadataStyle({ colorMin: e.target.value })
                }
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-muted-foreground">Max</span>
              <input
                type="color"
                className="h-6 w-10 cursor-pointer rounded border border-border bg-background p-0"
                value={metadataStyle.colorMax}
                onChange={(e) =>
                  setMetadataStyle({ colorMax: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        <div className="h-px w-full bg-border" />

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[11px] font-medium text-muted-foreground">
              Size by
            </label>
            <select
              className="h-7 flex-1 rounded-md border bg-background px-2 text-[11px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={metadataStyle.sizeAttribute ?? ""}
              onChange={(e) =>
                setMetadataStyle({
                  sizeAttribute: e.target.value || null,
                })
              }
            >
              <option value="">None</option>
              {nodeNumericKeys.map((key: string) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </div>
   
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="text-[11px] text-muted-foreground">Min</span>
              <input
                type="range"
                min={0.5}
                max={10}
                step={0.5}
                value={metadataStyle.sizeMin}
                onChange={(e) =>
                  setMetadataStyle({ sizeMin: Number(e.target.value) })
                }
              />
            </div>
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="text-[11px] text-muted-foreground">Max</span>
              <input
                type="range"
                min={0.5}
                max={15}
                step={0.5}
                value={metadataStyle.sizeMax}
                onChange={(e) =>
                  setMetadataStyle({ sizeMax: Number(e.target.value) })
                }
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
