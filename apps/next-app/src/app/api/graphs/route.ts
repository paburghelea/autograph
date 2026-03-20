import { NextRequest, NextResponse } from "next/server";
import * as store from "@/lib/store";
import type { CreateGraphPayload, GraphData } from "@/types/graph";

// Required for `output: "export"` so Next can prerender this route handler.
// Note: GitHub Pages will not support POST/PATCH/DELETE as real APIs,
// but these exports unblock the static build pipeline.
export const dynamic = "force-static";
export const revalidate = 0;

export async function GET() {
  try {
    const files = await store.listGraphFiles();
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
    if (
      !graph ||
      !Array.isArray(graph.nodes) ||
      !Array.isArray(graph.links)
    ) {
      return NextResponse.json(
        {
          error:
            "Missing or invalid 'graph' (must have nodes array and links array)",
        },
        { status: 400 }
      );
    }

    const graphData: GraphData = { nodes: graph.nodes, links: graph.links };

    const file = await store.createGraphFile(name, graphData, {
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
