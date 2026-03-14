import type { GraphData, GraphNode, GraphLink } from "@/types/graph";

/**
 * Result of the column–floor connection test.
 * Tests that every Building Element of type Column touches at least one
 * Building Element of type Floor (via graph links). Score is 0–100.
 */
export interface ColumnFloorTestResult {
  /** Score 0–100: percentage of columns that touch at least one floor */
  score: number;
  totalColumns: number;
  passedCount: number;
  failedCount: number;
  failedColumnIds: string[];
  message: string;
}

const BUILDING_ELEMENT_KEY = "Building Element";
const COLUMN_VALUE = "Column";
const FLOOR_VALUE = "Floor";

/** Value of node["Building Element"] for columns/floors */
function getBuildingElementValue(node: GraphNode): string | undefined {
  const v = node[BUILDING_ELEMENT_KEY];
  return typeof v === "string" ? v : undefined;
}

function isColumn(node: GraphNode): boolean {
  const value = getBuildingElementValue(node);
  if (value === COLUMN_VALUE) return true;
  const name = (node.name ?? "") as string;
  if (name && typeof name === "string" && /column/i.test(name)) return true;
  return false;
}

function isFloor(node: GraphNode): boolean {
  const value = getBuildingElementValue(node);
  if (value === FLOOR_VALUE) return true;
  const name = (node.name ?? "") as string;
  if (name && typeof name === "string" && /floor|slab/i.test(name)) return true;
  return false;
}

/** Build set of node ids that are floors */
function getFloorIds(nodes: GraphNode[]): Set<string> {
  const set = new Set<string>();
  for (const n of nodes) if (isFloor(n)) set.add(n.id);
  return set;
}

/** Collect all (source, target) pairs from every link set (for collision/connection check) */
function getAllLinkPairs(data: GraphData): Set<string> {
  const pairs = new Set<string>();
  const key = (a: string, b: string) => (a < b ? `${a}\t${b}` : `${b}\t${a}`);
  for (const linkSet of data.links ?? []) {
    for (const link of linkSet.links ?? []) {
      const s = String(link.source);
      const t = String(link.target);
      pairs.add(key(s, t));
    }
  }
  return pairs;
}

/** Check if two node ids are connected by any link (in any set) */
function areConnected(linkPairs: Set<string>, idA: string, idB: string): boolean {
  const k = idA < idB ? `${idA}\t${idB}` : `${idB}\t${idA}`;
  return linkPairs.has(k);
}

/**
 * Run the column–floor test: every Building Element of type Column must touch
 * (be linked to) at least one Building Element of type Floor. Produces a score
 * 0–100 and lists which columns failed.
 */
export function runColumnFloorTest(data: GraphData): ColumnFloorTestResult {
  const nodes = data.nodes ?? [];
  const columnNodes = nodes.filter(isColumn);
  const floorIds = getFloorIds(nodes);
  const linkPairs = getAllLinkPairs(data);

  const totalColumns = columnNodes.length;
  const failedColumnIds: string[] = [];

  for (const col of columnNodes) {
    let touchesFloor = false;
    for (const floorId of floorIds) {
      if (areConnected(linkPairs, col.id, floorId)) {
        touchesFloor = true;
        break;
      }
    }
    if (!touchesFloor) failedColumnIds.push(col.id);
  }

  const passedCount = totalColumns - failedColumnIds.length;
  const failedCount = failedColumnIds.length;
  const score =
    totalColumns === 0 ? 100 : Math.round((passedCount / totalColumns) * 100);
  const message =
    totalColumns === 0
      ? "No Building Elements of type Column found to test."
      : failedCount === 0
        ? `All ${totalColumns} Column(s) touch at least one Floor. Score: ${score}/100.`
        : `${failedCount} of ${totalColumns} Column(s) do not touch any Floor. Score: ${score}/100.`;

  return {
    score,
    totalColumns,
    passedCount,
    failedCount,
    failedColumnIds,
    message,
  };
}

/**
 * Apply test result to the graph: ensure every node has a `faulty` attribute.
 * If a node does not have `faulty`, set it to false by default. If the node
 * is a Column that failed the test, set `faulty: true`. Updated graph is
 * written back to the database's graph_json column.
 */
export function applyColumnFloorTestToNodes(
  data: GraphData,
  result: ColumnFloorTestResult
): GraphData {
  const failedSet = new Set(result.failedColumnIds);
  const columnIds = new Set(
    (data.nodes ?? []).filter(isColumn).map((n) => n.id)
  );

  const nodes = (data.nodes ?? []).map((node) => {
    if (!columnIds.has(node.id)) {
      return { ...node, faulty: false } as GraphNode;
    }
    const failed = failedSet.has(node.id);
    return {
      ...node,
      tests: !failed,
      faulty: failed ? true : false,
    } as GraphNode;
  });

  return {
    ...data,
    nodes,
  };
}
