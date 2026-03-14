"use client";

import { create } from "zustand";
import type { GraphFile, GraphData, GraphNode } from "@/types/graph";

const EMPTY_GRAPH: GraphData = { nodes: [], links: [] };

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
    { source: "building", target: "structure", relation: "supported by" },
    { source: "building", target: "envelope", relation: "enclosed by" },
    { source: "building", target: "services", relation: "served by" },
    { source: "structure", target: "floor-slab", relation: "carries" },
    { source: "structure", target: "column-grid", relation: "organised by" },
    { source: "structure", target: "core", relation: "stabilised by" },
    { source: "envelope", target: "facade-panel", relation: "composed of" },
    { source: "envelope", target: "glazing-unit", relation: "integrates" },
    { source: "services", target: "hvac-plant", relation: "includes" },
    { source: "services", target: "duct-branch", relation: "distributes via" },
    { source: "floor-slab", target: "facade-panel", relation: "connects to" },
    { source: "duct-branch", target: "floor-slab", relation: "runs below" },
  ],
};

interface GraphStore {
  // State
  files: GraphFile[];
  currentFile: GraphFile | null;
  graphData: GraphData;
  selectedNode: GraphNode | null;
  newGraphName: string;
  rhinoFile: File | null;
  loading: boolean;
  saving: boolean;

  // Actions
  setFiles: (files: GraphFile[]) => void;
  setCurrentFile: (file: GraphFile | null) => void;
  setGraphData: (data: GraphData) => void;
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
  initWithDummyData: () => void;
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  files: [],
  currentFile: null,
  graphData: EMPTY_GRAPH,
  selectedNode: null,
  newGraphName: "",
  rhinoFile: null,
  loading: true,
  saving: false,

  setFiles: (files) => set({ files }),
  setCurrentFile: (currentFile) => set({ currentFile }),
  setGraphData: (graphData) => set({ graphData }),
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
    }),

  fetchFiles: async () => {
    set({ loading: true });
    try {
      const res = await fetch("/api/graphs");
      if (res.ok) {
        const data = await res.json();
        set({ files: data });
      }
    } catch (e) {
      console.error(e);
    } finally {
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
      if (res.ok) {
        const updated = await res.json();
        set((state) => ({
          currentFile: updated,
          files: state.files.map((f) => (f.id === updated.id ? updated : f)),
          rhinoFile: null,
        }));
      }
    } catch (e) {
      console.error(e);
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
      if (res.ok) {
        const created = await res.json();
        set((state) => ({
          files: [created, ...state.files],
          currentFile: created,
          graphData: created.graph,
          rhinoFile: null,
          newGraphName: "",
        }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      set({ saving: false });
    }
  },

  deleteFile: async (id) => {
    if (!confirm("Delete this graph?")) return;
    try {
      const res = await fetch(`/api/graphs/${id}`, { method: "DELETE" });
      if (res.ok) {
        const { currentFile } = get();
        set((state) => ({
          files: state.files.filter((f) => f.id !== id),
          ...(currentFile?.id === id
            ? { currentFile: null, graphData: EMPTY_GRAPH }
            : {}),
        }));
      }
    } catch (e) {
      console.error(e);
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
    set({
      currentFile: null,
      graphData: DUMMY_GRAPH,
      selectedNode: null,
      newGraphName: "Sample building tectonics",
      rhinoFile: null,
    });
  },
}));
