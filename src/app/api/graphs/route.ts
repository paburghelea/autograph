import { NextRequest, NextResponse } from "next/server";
import * as store from "@/lib/store";
import type { CreateGraphPayload, GraphData } from "@/types/graph";

export async function GET() {
  try {
    const files = store.listGraphFiles();
    return NextResponse.json(files);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to list graphs" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, graph, rhinoFileBase64, rhinoFileName } =
      body as CreateGraphPayload;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'name'" },
        { status: 400 }
      );
    }
    if (!graph || !Array.isArray(graph.nodes)) {
      return NextResponse.json(
        { error: "Missing or invalid 'graph' (must have nodes array)" },
        { status: 400 }
      );
    }

    const links = Array.isArray(graph.links) ? graph.links : [];
    const graphData: GraphData = { nodes: graph.nodes, links };

    const file = store.createGraphFile(name, graphData, {
      rhinoFileBase64,
      rhinoFileName,
    });
    return NextResponse.json(file);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to create graph" },
      { status: 500 }
    );
  }
}
