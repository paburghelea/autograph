import { NextRequest, NextResponse } from "next/server";
import * as store from "@/lib/store";
import type { GraphData } from "@/types/graph";

/**
 * POST /api/data
 * Receive graph data and create a new stored graph (for external clients / automation).
 * Body: { graph: { nodes, links }, name?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const graph = body.graph as GraphData | undefined;
    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : `Graph ${new Date().toISOString().slice(0, 19).replace("T", " ")}`;

    if (!graph || !Array.isArray(graph.nodes)) {
      return NextResponse.json(
        { error: "Missing or invalid 'graph' (must have nodes array)" },
        { status: 400 }
      );
    }

    const links = Array.isArray(graph.links) ? graph.links : [];
    const graphData: GraphData = { nodes: graph.nodes, links };

    const file = store.createGraphFile(name, graphData);
    return NextResponse.json(file);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to receive and store graph" },
      { status: 500 }
    );
  }
}
