"use client";

import type { GraphNode } from "@/types/graph";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NodeDetailPanelProps {
  node: GraphNode | null;
  onClose: () => void;
}

export function NodeDetailPanel({ node, onClose }: NodeDetailPanelProps) {
  if (!node) return null;

  const keyValuePairs = Object.entries(node).filter(
    ([k]) => !["id", "name", "x", "y", "z", "vx", "vy", "vz", "fx", "fy", "fz"].includes(k)
  );

  return (
    <div
      className={cn(
        "absolute right-4 top-4 z-10 w-72 rounded-lg border border-border bg-card/95 shadow-lg text-card-foreground"
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="font-semibold truncate pr-2">
          {node.name ?? node.id}
        </span>
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
      <div className="max-h-64 overflow-y-auto p-3">
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="font-medium text-muted-foreground">id</dt>
            <dd className="font-mono break-all">{node.id}</dd>
          </div>
          {keyValuePairs.map(([key, value]) => (
            <div key={key}>
              <dt className="font-medium text-muted-foreground">{key}</dt>
              <dd className="font-mono break-all">
                {typeof value === "object" && value !== null
                  ? JSON.stringify(value)
                  : String(value)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
