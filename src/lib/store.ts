/**
 * Server-side graph storage backed by Turso (libSQL).
 * API stays the same as before but data is persisted in the database.
 */

import type { GraphFile, GraphData } from "@/types/graph";
import { v4 as uuidv4 } from "uuid";
import { getDbClient } from "@/lib/db";

const TABLE_NAME = "graph_files";

let initialized = false;

async function ensureTable() {
  if (initialized) return;
  const db = getDbClient();
  await db.execute({
    sql: `
      CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        graph_json TEXT NOT NULL,
        rhino_file_base64 TEXT,
        rhino_file_name TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `,
    args: [],
  });
  initialized = true;
}

function rowToGraphFile(row: Record<string, unknown>): GraphFile {
  return {
    id: String(row.id),
    name: String(row.name),
    graph: JSON.parse(String(row.graph_json)) as GraphData,
    rhinoFileBase64:
      (row.rhino_file_base64 as string | null | undefined) ?? undefined,
    rhinoFileName:
      (row.rhino_file_name as string | null | undefined) ?? undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function listGraphFiles(): Promise<GraphFile[]> {
  await ensureTable();
  const db = getDbClient();
  const result = await db.execute({
    sql: `SELECT * FROM ${TABLE_NAME} ORDER BY updated_at DESC`,
    args: [],
  });
  return result.rows.map((row) => rowToGraphFile(row as any));
}

async function getGraphFile(id: string): Promise<GraphFile | undefined> {
  await ensureTable();
  const db = getDbClient();
  const result = await db.execute({
    sql: `SELECT * FROM ${TABLE_NAME} WHERE id = ? LIMIT 1`,
    args: [id],
  });
  const row = result.rows[0];
  if (!row) return undefined;
  return rowToGraphFile(row as any);
}

async function createGraphFile(
  name: string,
  graph: GraphData,
  options?: { rhinoFileBase64?: string; rhinoFileName?: string }
): Promise<GraphFile> {
  await ensureTable();
  const db = getDbClient();
  const now = new Date().toISOString();
  const id = uuidv4();

  const file: GraphFile = {
    id,
    name,
    graph,
    rhinoFileBase64: options?.rhinoFileBase64,
    rhinoFileName: options?.rhinoFileName,
    createdAt: now,
    updatedAt: now,
  };

  await db.execute({
    sql: `
      INSERT INTO ${TABLE_NAME} (
        id, name, graph_json, rhino_file_base64, rhino_file_name, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      file.id,
      file.name,
      JSON.stringify(file.graph),
      file.rhinoFileBase64 ?? null,
      file.rhinoFileName ?? null,
      file.createdAt,
      file.updatedAt,
    ],
  });

  return file;
}

async function updateGraphFile(
  id: string,
  updates: Partial<
    Pick<GraphFile, "name" | "graph" | "rhinoFileBase64" | "rhinoFileName">
  >
): Promise<GraphFile | undefined> {
  await ensureTable();
  const existing = await getGraphFile(id);
  if (!existing) return undefined;

  const updated: GraphFile = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const db = getDbClient();
  // graph_json stores the full graph; nodes may include faulty: true for failed column-floor test
  await db.execute({
    sql: `
      UPDATE ${TABLE_NAME}
      SET
        name = ?,
        graph_json = ?,
        rhino_file_base64 = ?,
        rhino_file_name = ?,
        updated_at = ?
      WHERE id = ?
    `,
    args: [
      updated.name,
      JSON.stringify(updated.graph),
      updated.rhinoFileBase64 ?? null,
      updated.rhinoFileName ?? null,
      updated.updatedAt,
      updated.id,
    ],
  });

  return updated;
}

async function deleteGraphFile(id: string): Promise<boolean> {
  await ensureTable();
  const db = getDbClient();
  const result = await db.execute({
    sql: `DELETE FROM ${TABLE_NAME} WHERE id = ?`,
    args: [id],
  });
  // libsql-client exposes rowsAffected on the result for write queries
  // If it's not available, treat success as true.
  const rowsAffected = (result as any).rowsAffected as number | undefined;
  return rowsAffected === undefined ? true : rowsAffected > 0;
}

export {
  listGraphFiles,
  getGraphFile,
  createGraphFile,
  updateGraphFile,
  deleteGraphFile,
};
