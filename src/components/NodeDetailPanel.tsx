"use client";

import type { GraphNode } from "@/types/graph";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Hash, Quote, Braces } from "lucide-react";

interface NodeDetailPanelProps {
  node: GraphNode | null;
  onClose: () => void;
}

function renderValue(value: unknown) {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function MetadataTypeIcon({ value }: { value: unknown }) {
  if (value == null) return null;
  if (typeof value === "number") {
    return (
      <Hash
        className="size-3.5 shrink-0 text-muted-foreground/70"
        aria-label="Number"
      />
    );
  }
  if (typeof value === "string") {
    return (
      <Quote
        className="size-3.5 shrink-0 text-muted-foreground/70"
        aria-label="String"
      />
    );
  }
  if (typeof value === "object") {
    return (
      <Braces
        className="size-3.5 shrink-0 text-muted-foreground/70"
        aria-label="Object"
      />
    );
  }
  return null;
}

export function NodeDetailPanel({ node, onClose }: NodeDetailPanelProps) {
  if (!node) return null;

  const reserved = [
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
    "__threeObj",
    "__ObjData",
  ];
  const keyValuePairs = Object.entries(node).filter(
    ([k]) => !reserved.includes(k)
  );
  const isFaulty = node.faulty === true;

  return (
    <div
      className={cn(
        "absolute right-1 top-16 z-10  rounded-xl border bg-background max-w-[min(100%,20rem)] text-card-foreground",
        isFaulty ? "border-destructive border-2" : "border-border"
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="font-semibold text-sm truncate pr-2">
          {node.name ?? node.id}
        </span>
        {isFaulty && (
          <span className="shrink-0 rounded bg-destructive/20 px-2 py-0.5 text-xs font-medium text-destructive">
            Faulty
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </Button>
      </div>
      <div className="max-h-96 overflow-y-auto p-3">
        <table className="w-full text-xs">
          <tbody>
            <tr>
              <th className="w-24 pb-1 pr-2 text-left align-top font-medium text-muted-foreground text-xs">
                id
              </th>
              <td className="pb-1 align-top font-mono break-all flex items-center gap-1.5">
                <MetadataTypeIcon value={node.id} />
                {renderValue(node.id)}
              </td>
            </tr>
            {keyValuePairs.map(([key, value]) => (
              <tr key={key}>
                <th className="w-24 pb-1 pr-2 text-left align-top font-medium text-muted-foreground break-all text-xs truncate no-wrap whitespace-nowrap">
                  {key}
                </th>
                <td className="pb-1 align-top font-mono break-all text-xs truncate no-wrap whitespace-nowrap">
                  <span className="flex items-center gap-1.5">
                    <MetadataTypeIcon value={value} />
                    <span className="truncate no-wrap whitespace-nowrap w-full">{renderValue(value)}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
