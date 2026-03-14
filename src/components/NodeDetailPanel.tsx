"use client";

import type { GraphNode } from "@/types/graph";

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
    <div className="absolute right-4 top-4 z-10 w-72 rounded-lg border border-zinc-200 bg-white/95 shadow-lg dark:border-zinc-700 dark:bg-zinc-900/95">
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
          {node.name ?? node.id}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto p-3">
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="font-medium text-zinc-500 dark:text-zinc-400">id</dt>
            <dd className="font-mono text-zinc-900 dark:text-zinc-100">{node.id}</dd>
          </div>
          {keyValuePairs.map(([key, value]) => (
            <div key={key}>
              <dt className="font-medium text-zinc-500 dark:text-zinc-400">{key}</dt>
              <dd className="font-mono text-zinc-900 dark:text-zinc-100 break-all">
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
