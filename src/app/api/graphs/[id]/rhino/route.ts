import { NextRequest, NextResponse } from "next/server";
import * as store from "@/lib/store";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET: Download the Rhino .3dm file associated with a graph (if any).
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params;
  const file = store.getGraphFile(id);
  if (!file) {
    return NextResponse.json({ error: "Graph not found" }, { status: 404 });
  }
  if (!file.rhinoFileBase64) {
    return NextResponse.json(
      { error: "No Rhino file attached to this graph" },
      { status: 404 }
    );
  }

  const buffer = Buffer.from(file.rhinoFileBase64, "base64");
  const filename = file.rhinoFileName || "model.3dm";
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
