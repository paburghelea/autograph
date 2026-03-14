"use client";

import type { GraphNode } from "@/types/graph";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HashIcon, TypeIcon } from "lucide-react";

interface NodeDetailPanelProps {
  node: GraphNode | null;
  onClose: () => void;
}

function renderValueWithIcon(value: unknown) {
  const isObject = typeof value === "object" && value !== null;
  const display =
    isObject ? JSON.stringify(value) : value != null ? String(value) : "";

  return (
    <div className="flex items-center gap-1">
      {typeof value === "string" && (
        <TypeIcon className="size-3 shrink-0 text-muted-foreground" />
      )}
      {typeof value === "number" && (
        <HashIcon className="size-3 shrink-0 text-muted-foreground" />
      )}
      <span className="font-mono break-all">{display}</span>
    </div>
  );
}

export function NodeDetailPanel({ node, onClose }: NodeDetailPanelProps) {
  if (!node) return null;

  const keyValuePairs = Object.entries(node).filter(
    ([k]) =>
      ![
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
      ].includes(k)
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
      <div className="max-h-64 overflow-y-auto p-3">
        <table className="w-full text-xs">
          <tbody>
            <tr>
              <th className="w-24 pb-1 pr-2 text-left align-top font-medium text-muted-foreground">
                id
              </th>
              <td className="pb-1 align-top">
                {renderValueWithIcon(node.id)}
              </td>
            </tr>
            {keyValuePairs.map(([key, value]) => (
              <tr key={key}>
                <th className="w-24 pb-1 pr-2 text-left align-top font-medium text-muted-foreground">
                  {key}
                </th>
                <td className="pb-1 align-top">
                  {renderValueWithIcon(value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
