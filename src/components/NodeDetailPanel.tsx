"use client";

import type { GraphNode } from "@/types/graph";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NodeDetailPanelProps {
  node: GraphNode | null;
  onClose: () => void;
}

function renderValue(value: unknown) {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
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

  return (
    <div
      className={cn(
        "absolute right-1 top-12 z-10 w-80 rounded-lg border border-border bg-card/95 shadow-lg text-card-foreground"
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
      <div className="max-h-96 overflow-y-auto p-3">
        <table className="w-full text-xs">
          <tbody>
            <tr>
              <th className="w-24 pb-1 pr-2 text-left align-top font-medium text-muted-foreground">
                id
              </th>
              <td className="pb-1 align-top font-mono break-all">
                {renderValue(node.id)}
              </td>
            </tr>
            {keyValuePairs.map(([key, value]) => (
              <tr key={key}>
                <th className="w-24 pb-1 pr-2 text-left align-top font-medium text-muted-foreground break-all">
                  {key}
                </th>
                <td className="pb-1 align-top font-mono break-all">
                  {renderValue(value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
