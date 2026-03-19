import { NextRequest, NextResponse } from "next/server";
import * as store from "@/lib/store";
import type { UpdateGraphPayload, GraphData } from "@/types/graph";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params;
  const file = await store.getGraphFile(id);
  if (!file) {
    return NextResponse.json({ error: "Graph not found" }, { status: 404 });
  }
  return NextResponse.json(file);
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params;
  const file = await store.getGraphFile(id);
  if (!file) {
    return NextResponse.json({ error: "Graph not found" }, { status: 404 });
  }

  try {
    const body = (await request.json()) as UpdateGraphPayload;
    const updates: Parameters<typeof store.updateGraphFile>[1] = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.graph !== undefined) {
      const nodes = Array.isArray(body.graph.nodes)
        ? body.graph.nodes
        : file.graph.nodes;
      const links = Array.isArray(body.graph.links)
        ? body.graph.links
        : file.graph.links;
      updates.graph = { nodes, links };
    }
    if (body.rhinoFileBase64 !== undefined)
      updates.rhinoFileBase64 = body.rhinoFileBase64;
    if (body.rhinoFileName !== undefined)
      updates.rhinoFileName = body.rhinoFileName;

    const updated = await store.updateGraphFile(id, updates);
    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to update graph" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params;
  const deleted = await store.deleteGraphFile(id);
  if (!deleted) {
    return NextResponse.json({ error: "Graph not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
