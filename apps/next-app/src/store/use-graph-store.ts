"use client";

import { create } from "zustand";
import type { GraphFile, GraphData, GraphNode } from "@/types/graph";
import { SAMPLE_DEFINITIONS, type SampleId } from "@/lib/sample-graphs";
import {
  runColumnFloorTest,
  applyColumnFloorTestToNodes,
  type ColumnFloorTestResult,
} from "@/lib/column-floor-test";

const EMPTY_GRAPH: GraphData = { nodes: [], links: [] };
const LOCAL_STORAGE_FILES_KEY = "autograph:graphs:v1";
const LOCAL_STORAGE_CURRENT_ID_KEY = "autograph:currentGraphId:v1";

function isGraphData(v: unknown): v is GraphData {
  if (!v || typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  return (
    Array.isArray(obj.nodes) &&
    Array.isArray(obj.links)
  );
}

function readLocalFiles(): GraphFile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_FILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Minimal validation to avoid crashing on unexpected shapes.
    return (parsed as GraphFile[]).filter((f) => {
      return (
        f &&
        typeof f === "object" &&
        typeof f.id === "string" &&
        typeof f.name === "string" &&
        typeof f.createdAt === "string" &&
        typeof f.updatedAt === "string" &&
        isGraphData((f as GraphFile).graph)
      );
    });
  } catch {
    return [];
  }
}

function writeLocalFiles(files: GraphFile[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_FILES_KEY, JSON.stringify(files));
  } catch {
    // Ignore storage quota / serialization errors.
  }
}

function persistLocalCurrentId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (!id) window.localStorage.removeItem(LOCAL_STORAGE_CURRENT_ID_KEY);
    else window.localStorage.setItem(LOCAL_STORAGE_CURRENT_ID_KEY, id);
  } catch {
    // ignore
  }
}

function makeId(): string {
  // Prefer WebCrypto where available (browser).
  const c = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `local-${Math.random().toString(16).slice(2)}-${Date.now()}`;
}

function mergeLocalFiles(next: GraphFile[], updated: GraphFile): GraphFile[] {
  const idx = next.findIndex((f) => f.id === updated.id);
  if (idx === -1) return [updated, ...next];
  const copy = next.slice();
  copy[idx] = updated;
  return copy;
}

const DUMMY_GRAPH: GraphData = {
  nodes: [
    {
      id: "building",
      name: "Building",
      category: "system",
      elementType: "overall",
    },
    {
      id: "structure",
      name: "Structural Frame",
      category: "system",
      elementType: "structure",
      material: "reinforced concrete + steel",
    },
    {
      id: "envelope",
      name: "Envelope",
      category: "system",
      elementType: "façade",
      material: "unitised curtain wall",
    },
    {
      id: "services",
      name: "Building Services",
      category: "system",
      elementType: "MEP",
    },
    {
      id: "floor-slab",
      name: "Floor Slab",
      category: "tectonic",
      elementType: "slab",
      material: "post-tensioned concrete",
      level: "typical office",
    },
    {
      id: "column-grid",
      name: "Column Grid",
      category: "tectonic",
      elementType: "column",
      material: "steel H-section",
      grid: "8m x 8m",
    },
    {
      id: "facade-panel",
      name: "Façade Panel",
      category: "tectonic",
      elementType: "panel",
      material: "glass + aluminium",
      performance: "low-e double glazing",
    },
    {
      id: "roof",
      name: "Roof Assembly",
      category: "tectonic",
      elementType: "roof",
      material: "steel deck + insulation + membrane",
    },
    {
      id: "core",
      name: "Core Shear Wall",
      category: "tectonic",
      elementType: "shear wall",
      material: "reinforced concrete",
    },
    {
      id: "hvac-plant",
      name: "HVAC Plant",
      category: "services",
      elementType: "air handling unit",
      location: "roof plant",
    },
    {
      id: "duct-branch",
      name: "Supply Duct Branch",
      category: "services",
      elementType: "duct",
      material: "galvanised steel",
      level: "typical office",
    },
    {
      id: "glazing-unit",
      name: "Glazing Unit",
      category: "component",
      elementType: "IGU",
      material: "double-glazed low-e",
      uValue: 1.2,
    },
  ],
  links: [
    {
      set: "Systems overview",
      notes: "High-level relationships between primary building systems.",
      links: [
        { source: "building", target: "structure", relation: "supported by" },
        { source: "building", target: "envelope", relation: "enclosed by" },
        { source: "building", target: "services", relation: "served by" },
      ],
    },
    {
      set: "Structural tectonics",
      notes: "Structural load path and key tectonic elements.",
      links: [
        { source: "structure", target: "floor-slab", relation: "carries" },
        {
          source: "structure",
          target: "column-grid",
          relation: "organised by",
        },
        { source: "structure", target: "core", relation: "stabilised by" },
      ],
    },
    {
      set: "Envelope tectonics",
      notes: "Façade composition and interface with structure.",
      links: [
        { source: "envelope", target: "facade-panel", relation: "composed of" },
        { source: "envelope", target: "glazing-unit", relation: "integrates" },
        {
          source: "floor-slab",
          target: "facade-panel",
          relation: "connects to",
        },
      ],
    },
    {
      set: "Services distribution",
      notes: "MEP systems and their spatial relationships.",
      links: [
        { source: "services", target: "hvac-plant", relation: "includes" },
        {
          source: "services",
          target: "duct-branch",
          relation: "distributes via",
        },
        {
          source: "duct-branch",
          target: "floor-slab",
          relation: "runs below",
        },
      ],
    },
  ],
};

export interface MetadataStyle {
  colorAttribute: string | null;
  colorMin: string;
  colorMax: string;
  sizeAttribute: string | null;
  sizeMin: number;
  sizeMax: number;
}

const DEFAULT_METADATA_STYLE: MetadataStyle = {
  colorAttribute: null,
  colorMin: "#3b82f6",
  colorMax: "#ef4444",
  sizeAttribute: null,
  sizeMin: 1,
  sizeMax: 5,
};

interface GraphStore {
  // State
  files: GraphFile[];
  currentFile: GraphFile | null;
  graphData: GraphData;
  metadataStyle: MetadataStyle;
  selectedNode: GraphNode | null;
  newGraphName: string;
  rhinoFile: File | null;
  loading: boolean;
  saving: boolean;
  /** Last column–floor test result (score, message, etc.) */
  columnFloorTestResult: ColumnFloorTestResult | null;
  /** When true, periodically check server updated_at and pull new data if newer */
  liveUpdateMode: boolean;
  /** When true, node colors show faulty=red and non-faulty=green */
  errorPreviewMode: boolean;

  // Actions
  setFiles: (files: GraphFile[]) => void;
  setCurrentFile: (file: GraphFile | null) => void;
  setGraphData: (data: GraphData) => void;
  setMetadataStyle: (style: Partial<MetadataStyle>) => void;
  setSelectedNode: (node: GraphNode | null) => void;
  setNewGraphName: (name: string) => void;
  setRhinoFile: (file: File | null) => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;

  loadFile: (file: GraphFile) => void;
  fetchFiles: () => Promise<void>;
  save: () => Promise<void>;
  saveAsNew: () => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  downloadRhino: () => Promise<void>;
  initWithSample: (id: SampleId) => void;
  initWithDummyData: () => void;
  /** Run column–floor connection test, update nodes with faulty, and persist to DB */
  runColumnFloorTest: () => Promise<ColumnFloorTestResult>;
  setLiveUpdateMode: (enabled: boolean) => void;
  setErrorPreviewMode: (enabled: boolean) => void;
  /** Fetch current file from server; if updated_at is newer, load the new data */
  checkForUpdates: () => Promise<void>;
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  files: [],
  currentFile: null,
  graphData: EMPTY_GRAPH,
  metadataStyle: DEFAULT_METADATA_STYLE,
  selectedNode: null,
  newGraphName: "",
  rhinoFile: null,
  loading: true,
  saving: false,
  columnFloorTestResult: null,
  liveUpdateMode: false,
  errorPreviewMode: false,

  setFiles: (files) => set({ files }),
  setCurrentFile: (currentFile) => set({ currentFile }),
  setGraphData: (graphData) => set({ graphData }),
  setMetadataStyle: (style) =>
    set((state) => ({
      metadataStyle: { ...state.metadataStyle, ...style },
    })),
  setSelectedNode: (selectedNode) => set({ selectedNode }),
  setNewGraphName: (newGraphName) => set({ newGraphName }),
  setRhinoFile: (rhinoFile) => set({ rhinoFile }),
  setLoading: (loading) => set({ loading }),
  setSaving: (saving) => set({ saving }),

  loadFile: (file) =>
    set({
      currentFile: file,
      graphData: file.graph,
      selectedNode: null,
      columnFloorTestResult: null,
    }),

  fetchFiles: async () => {
    set({ loading: true });
    try {
      const res = await fetch("/api/graphs");
      if (res.ok) {
        const data = await res.json();
        set({ files: data });
        // Keep local cache in sync when possible.
        if (Array.isArray(data)) {
          writeLocalFiles(data as GraphFile[]);
          // If local cache already has a current id, keep it.
          // (When DB works, we don't auto-select currentFile here.)
        }
        return;
      }
    } catch (e) {
      console.error(e);
    } finally {
      // Fallback: load local cache when API is down.
      const localFiles = readLocalFiles();
      if (localFiles.length > 0) {
        const currentId = (() => {
          if (typeof window === "undefined") return null;
          try {
            return window.localStorage.getItem(LOCAL_STORAGE_CURRENT_ID_KEY);
          } catch {
            return null;
          }
        })();
        const currentFile = currentId
          ? localFiles.find((f) => f.id === currentId) ?? null
          : null;

        set({
          files: localFiles,
          ...(currentFile
            ? {
                currentFile,
                graphData: currentFile.graph,
                selectedNode: null,
                columnFloorTestResult: null,
              }
            : {}),
        });
      }

      set({ loading: false });
    }
  },

  save: async () => {
    const { currentFile, graphData, newGraphName, rhinoFile } = get();
    if (!currentFile) return;
    set({ saving: true });
    try {
      let rhinoBase64: string | undefined;
      let rhinoFileName: string | undefined;
      if (rhinoFile) {
        const buf = await rhinoFile.arrayBuffer();
        rhinoBase64 = btoa(
          new Uint8Array(buf).reduce((acc, byte) => acc + String.fromCharCode(byte), "")
        );
        rhinoFileName = rhinoFile.name;
      }
      const res = await fetch(`/api/graphs/${currentFile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newGraphName || currentFile.name,
          graph: graphData,
          ...(rhinoBase64 && { rhinoFileBase64: rhinoBase64, rhinoFileName }),
        }),
      });
      if (!res.ok) {
        throw new Error(`Save failed (HTTP ${res.status})`);
      }

      const updated = await res.json();
      set((state) => ({
        currentFile: updated,
        files: state.files.map((f) => (f.id === updated.id ? updated : f)),
        rhinoFile: null,
      }));
      // Also persist to local storage.
      const existing = readLocalFiles();
      const now = new Date().toISOString();
      const updatedWithTimestamps: GraphFile = {
        ...updated,
        updatedAt: updated.updatedAt ?? now,
        createdAt: updated.createdAt ?? updated.updatedAt ?? now,
      };
      const merged = mergeLocalFiles(existing, updatedWithTimestamps);
      writeLocalFiles(merged);
      persistLocalCurrentId(updated.id);
    } catch (e) {
      console.error(e);
      // Persist locally if the API is unavailable.
      const now = new Date().toISOString();
      let rhinoBase64Local: string | undefined;
      if (rhinoFile) {
        const buf = await rhinoFile.arrayBuffer();
        if (buf.byteLength > 0) {
          rhinoBase64Local = btoa(
            new Uint8Array(buf).reduce(
              (acc, byte) => acc + String.fromCharCode(byte),
              ""
            )
          );
        }
      }
      const rhinoFileNameLocal = rhinoFile?.name;

      const localUpdated: GraphFile = {
        ...currentFile,
        name: newGraphName || currentFile.name,
        graph: graphData,
        updatedAt: now,
        createdAt: currentFile.createdAt ?? now,
        ...(rhinoBase64Local && {
          rhinoFileBase64: rhinoBase64Local,
          rhinoFileName: rhinoFileNameLocal,
        }),
      };
      set((state) => ({
        currentFile: localUpdated,
        files: state.files.map((f) => (f.id === localUpdated.id ? localUpdated : f)),
        rhinoFile: null,
      }));
      const existing = readLocalFiles();
      const merged = mergeLocalFiles(existing, localUpdated);
      writeLocalFiles(merged);
      persistLocalCurrentId(localUpdated.id);
    } finally {
      set({ saving: false });
    }
  },

  saveAsNew: async () => {
    const { graphData, newGraphName, rhinoFile } = get();
    const name =
      newGraphName.trim() || `Graph ${new Date().toLocaleString()}`;
    set({ saving: true });
    try {
      let rhinoBase64: string | undefined;
      let rhinoFileName: string | undefined;
      if (rhinoFile) {
        const buf = await rhinoFile.arrayBuffer();
        rhinoBase64 = btoa(
          new Uint8Array(buf).reduce((acc, byte) => acc + String.fromCharCode(byte), "")
        );
        rhinoFileName = rhinoFile.name;
      }
      const res = await fetch("/api/graphs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          graph: graphData,
          rhinoFileBase64: rhinoBase64,
          rhinoFileName,
        }),
      });
      if (!res.ok) {
        throw new Error(`Save as new failed (HTTP ${res.status})`);
      }

      const created = await res.json();
      set((state) => ({
        files: [created, ...state.files],
        currentFile: created,
        graphData: created.graph,
        rhinoFile: null,
        newGraphName: "",
      }));
      // Also persist to local storage.
      const existing = readLocalFiles();
      const now = new Date().toISOString();
      const createdWithTimestamps: GraphFile = {
        ...created,
        updatedAt: created.updatedAt ?? now,
        createdAt: created.createdAt ?? created.updatedAt ?? now,
      };
      const merged = mergeLocalFiles(existing, createdWithTimestamps);
      writeLocalFiles(merged);
      persistLocalCurrentId(createdWithTimestamps.id);
    } catch (e) {
      console.error(e);
      // Persist locally when API is down.
      const now = new Date().toISOString();
      const id = makeId();
      let rhinoBase64Local: string | undefined;
      if (rhinoFile) {
        const buf = await rhinoFile.arrayBuffer();
        rhinoBase64Local = btoa(
          new Uint8Array(buf).reduce((acc, byte) => acc + String.fromCharCode(byte), "")
        );
      }
      const localCreated: GraphFile = {
        id,
        name,
        graph: graphData,
        rhinoFileBase64: rhinoBase64Local,
        rhinoFileName: rhinoFile?.name,
        createdAt: now,
        updatedAt: now,
      };
      set((state) => ({
        files: [localCreated, ...state.files],
        currentFile: localCreated,
        graphData: localCreated.graph,
        rhinoFile: null,
        newGraphName: "",
      }));
      const existing = readLocalFiles();
      const merged = mergeLocalFiles(existing, localCreated);
      writeLocalFiles(merged);
      persistLocalCurrentId(localCreated.id);
    } finally {
      set({ saving: false });
    }
  },

  deleteFile: async (id) => {
    if (!confirm("Delete this graph?")) return;
    try {
      const res = await fetch(`/api/graphs/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(`Delete failed (HTTP ${res.status})`);
      }

      const { currentFile } = get();
      set((state) => ({
        files: state.files.filter((f) => f.id !== id),
        ...(currentFile?.id === id
          ? { currentFile: null, graphData: EMPTY_GRAPH }
          : {}),
      }));
      // Persist locally.
      const existing = readLocalFiles();
      const remaining = existing.filter((f) => f.id !== id);
      writeLocalFiles(remaining);
      persistLocalCurrentId(
        currentFile?.id === id ? null : currentFile?.id ?? null
      );
    } catch (e) {
      console.error(e);
      // Local fallback even when API is down.
      const { currentFile } = get();
      set((state) => ({
        files: state.files.filter((f) => f.id !== id),
        ...(currentFile?.id === id
          ? { currentFile: null, graphData: EMPTY_GRAPH }
          : {}),
      }));
      const existing = readLocalFiles();
      const remaining = existing.filter((f) => f.id !== id);
      writeLocalFiles(remaining);
      persistLocalCurrentId(currentFile?.id === id ? null : currentFile?.id ?? null);
    }
  },

  downloadRhino: async () => {
    const { currentFile } = get();
    if (!currentFile?.id || !currentFile.rhinoFileBase64) return;
    try {
      const res = await fetch(`/api/graphs/${currentFile.id}/rhino`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = currentFile.rhinoFileName || "model.3dm";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  },

  initWithDummyData: () => {
    get().initWithSample("overview");
  },

  initWithSample: (id) => {
    const def = SAMPLE_DEFINITIONS.find((s) => s.id === id);

    set({
      currentFile: null,
      graphData: def?.graph ?? DUMMY_GRAPH,
      selectedNode: null,
      metadataStyle: DEFAULT_METADATA_STYLE,
      newGraphName: def?.name ?? "Sample building tectonics",
      rhinoFile: null,
      columnFloorTestResult: null,
    });
  },

  runColumnFloorTest: async () => {
    const { graphData, currentFile } = get();
    const result = runColumnFloorTest(graphData);
    const updatedGraph = applyColumnFloorTestToNodes(graphData, result);
    set({
      graphData: updatedGraph,
      columnFloorTestResult: result,
    });
    // Write updated graph (faulty on relevant nodes) to graph_json column
    if (currentFile?.id) {
      const { save } = get();
      await save();
    }
    return result;
  },

  setLiveUpdateMode: (liveUpdateMode) => set({ liveUpdateMode }),
  setErrorPreviewMode: (errorPreviewMode) => set({ errorPreviewMode }),

  checkForUpdates: async () => {
    const { currentFile, loadFile } = get();
    if (!currentFile?.id) return;
    try {
      const res = await fetch(`/api/graphs/${currentFile.id}`);
      if (!res.ok) return;
      const serverFile = (await res.json()) as GraphFile;
      if (serverFile.updatedAt && currentFile.updatedAt) {
        const serverTime = new Date(serverFile.updatedAt).getTime();
        const localTime = new Date(currentFile.updatedAt).getTime();
        if (serverTime > localTime) {
          loadFile(serverFile);
          const { files } = get();
          set({
            files: files.map((f) => (f.id === serverFile.id ? serverFile : f)),
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  },
}));
