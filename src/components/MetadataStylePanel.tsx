"use client";

import type { JSX } from "react";
import { useMemo } from "react";
import { useGraphStore } from "@/store/use-graph-store";
import { cn } from "@/lib/utils";

export function MetadataStylePanel(): JSX.Element | null {
  const { graphData, metadataStyle, setMetadataStyle } = useGraphStore();

  const numericKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const node of graphData.nodes) {
      for (const [key, value] of Object.entries(node)) {
        if (
          [
            "id",
            "name",
            "x",
            "y",
            "z",
            "vx",
            "vy",
            "vz",
            "fx",
            "fy",
            "fz",
            "color",
          ].includes(key)
        ) {
          continue;
        }
        if (value === null || value === undefined) continue;
        if (typeof value === "number") {
          keys.add(key);
        }
      }
    }
    return Array.from(keys).sort();
  }, [graphData.nodes]);

  if (!graphData.nodes.length || !numericKeys.length) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute right-1 top-56 z-10 w-80 rounded-lg border border-border bg-card/95 shadow-lg text-card-foreground"
      )}
    >
      <div className="border-b border-border px-3 py-2">
        <p className="text-xs font-semibold text-muted-foreground">
          Metadata preview
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground/80">
          Map numeric attributes to node colors and sizes.
        </p>
      </div>
      <div className="space-y-3 p-3 text-xs">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[11px] font-medium text-muted-foreground">
              Color by
            </label>
            <select
              className="h-7 flex-1 rounded-md border bg-background px-2 text-[11px] shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={metadataStyle.colorAttribute ?? ""}
              onChange={(e) =>
                setMetadataStyle({
                  colorAttribute: e.target.value || null,
                })
              }
            >
              <option value="">None</option>
              {numericKeys.map((key: string) => (
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
              className="h-7 flex-1 rounded-md border bg-background px-2 text-[11px] shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={metadataStyle.sizeAttribute ?? ""}
              onChange={(e) =>
                setMetadataStyle({
                  sizeAttribute: e.target.value || null,
                })
              }
            >
              <option value="">None</option>
              {numericKeys.map((key: string) => (
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
    </div>
  );
}
