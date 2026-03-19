/**
 * Recursively collect numeric (and optional string) paths from node metadata
 * so nested fields like __threeObj.geometries.0.radius can be used in the metadata filter.
 */

const RESERVED_TOP_KEYS = new Set([
  "id",
  "name",
  "x",
  "y",
  "z",
  "vx",
  "vy",
  "vz",
  "fx",
  "fy",
  "fz",
  "color",
]);

function collectPaths(
  obj: unknown,
  prefix: string,
  numericPaths: Set<string>,
  stringPaths: Set<string>,
  skipTopKeys?: Set<string>
): void {
  if (obj === null || obj === undefined) return;

  if (typeof obj === "number") {
    numericPaths.add(prefix);
    return;
  }
  if (typeof obj === "string") {
    stringPaths.add(prefix);
    return;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      const segment = prefix ? `${prefix}.${i}` : String(i);
      collectPaths(item, segment, numericPaths, stringPaths, undefined);
    });
    return;
  }

  if (typeof obj === "object") {
    const skipKeys = prefix === "" ? skipTopKeys : undefined;
    for (const [key, value] of Object.entries(obj)) {
      if (skipKeys?.has(key)) continue;
      const segment = prefix ? `${prefix}.${key}` : key;
      collectPaths(value, segment, numericPaths, stringPaths, undefined);
    }
  }
}

/** Get all numeric paths found in the given nodes (for Color by / Size by). */
export function getNumericPathsFromNodes(
  nodes: Record<string, unknown>[]
): string[] {
  const numericPaths = new Set<string>();
  const stringPaths = new Set<string>();
  for (const node of nodes) {
    collectPaths(node, "", numericPaths, stringPaths, RESERVED_TOP_KEYS);
  }
  return Array.from(numericPaths).sort();
}

const RESERVED_LINK_KEYS = new Set(["source", "target"]);

/** Get all numeric paths found in the given links (for link styling). */
export function getNumericPathsFromLinks(
  linkSets: { links: Record<string, unknown>[] }[]
): string[] {
  const numericPaths = new Set<string>();
  const stringPaths = new Set<string>();
  for (const set of linkSets) {
    for (const link of set.links ?? []) {
      collectPaths(
        link,
        "",
        numericPaths,
        stringPaths,
        RESERVED_LINK_KEYS
      );
    }
  }
  return Array.from(numericPaths).sort();
}

/** Get a value from an object by dot-notation path (e.g. "__threeObj.geometries.0.radius"). */
export function getValueByPath(
  obj: Record<string, unknown>,
  path: string
): unknown {
  if (!path) return undefined;
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    const num = Number(part);
    const key =
      Number.isFinite(num) && String(num) === part ? num : part;
    current = (current as Record<string, unknown>)[key as string];
  }
  return current;
}
