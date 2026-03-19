/**
 * Graph data types for the visualizer.
 * Each node has a unique id and a series of key-value pairs (attributes).
 */

export interface GraphNode {
  id: string;
  /** Display label (defaults to id if not set) */
  name?: string;
  /** Arbitrary key-value pairs for node metadata */
  [key: string]: unknown;
}

export interface GraphLink {
  source: string;
  target: string;
  /** Optional display name */
  name?: string;
  [key: string]: unknown;
}

export interface GraphData {
  nodes: GraphNode[];
  links: {
    set: string;
    notes?: string;
    links: GraphLink[];
  }[];
}

/**
 * A saved "file" in the app: one graph plus optional Rhino .3dm attachment.
 */
export interface GraphFile {
  id: string;
  name: string;
  graph: GraphData;
  /** Base64-encoded Rhino .3dm file content, if attached */
  rhinoFileBase64?: string;
  /** Original filename of the Rhino file */
  rhinoFileName?: string;
  createdAt: string;
  updatedAt: string;
}

/** Payload for POST /api/graphs (create or receive graph data) */
export interface CreateGraphPayload {
  name: string;
  graph: GraphData;
  rhinoFileBase64?: string;
  rhinoFileName?: string;
}

/** Payload for PATCH /api/graphs/[id] (update graph or attach Rhino) */
export interface UpdateGraphPayload {
  name?: string;
  graph?: GraphData;
  rhinoFileBase64?: string;
  rhinoFileName?: string;
}
