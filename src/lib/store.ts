/**
 * In-memory store for graph files.
 * In production you would replace this with a database.
 */

import type { GraphFile, GraphData } from "@/types/graph";
import { v4 as uuidv4 } from "uuid";

const store = new Map<string, GraphFile>();

export function listGraphFiles(): GraphFile[] {
  return Array.from(store.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getGraphFile(id: string): GraphFile | undefined {
  return store.get(id);
}

export function createGraphFile(
  name: string,
  graph: GraphData,
  options?: { rhinoFileBase64?: string; rhinoFileName?: string }
): GraphFile {
  const now = new Date().toISOString();
  const file: GraphFile = {
    id: uuidv4(),
    name,
    graph,
    rhinoFileBase64: options?.rhinoFileBase64,
    rhinoFileName: options?.rhinoFileName,
    createdAt: now,
    updatedAt: now,
  };
  store.set(file.id, file);
  return file;
}

export function updateGraphFile(
  id: string,
  updates: Partial<Pick<GraphFile, "name" | "graph" | "rhinoFileBase64" | "rhinoFileName">>
): GraphFile | undefined {
  const existing = store.get(id);
  if (!existing) return undefined;

  const updated: GraphFile = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  store.set(id, updated);
  return updated;
}

export function deleteGraphFile(id: string): boolean {
  return store.delete(id);
}
