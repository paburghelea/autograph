/**
 * Server-side graph storage using Zustand.
 * Used by API routes via getState().
 */

import { createStore } from "zustand/vanilla";
import type { GraphFile, GraphData } from "@/types/graph";
import { v4 as uuidv4 } from "uuid";

export interface GraphStoreState {
  files: Record<string, GraphFile>;
}

const graphStore = createStore<GraphStoreState>(() => ({
  files: {},
}));

function listGraphFiles(): GraphFile[] {
  const { files } = graphStore.getState();
  return Object.values(files).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

function getGraphFile(id: string): GraphFile | undefined {
  return graphStore.getState().files[id];
}

function createGraphFile(
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
  graphStore.setState((state) => ({
    files: { ...state.files, [file.id]: file },
  }));
  return file;
}

function updateGraphFile(
  id: string,
  updates: Partial<Pick<GraphFile, "name" | "graph" | "rhinoFileBase64" | "rhinoFileName">>
): GraphFile | undefined {
  const existing = graphStore.getState().files[id];
  if (!existing) return undefined;

  const updated: GraphFile = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  graphStore.setState((state) => ({
    files: { ...state.files, [id]: updated },
  }));
  return updated;
}

function deleteGraphFile(id: string): boolean {
  const { files } = graphStore.getState();
  if (!(id in files)) return false;
  const { [id]: _, ...rest } = files;
  graphStore.setState({ files: rest });
  return true;
}

export { listGraphFiles, getGraphFile, createGraphFile, updateGraphFile, deleteGraphFile };
