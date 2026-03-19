/** __threeObj is a flat object: string keys with number, string, or arbitrary values. */
export type ThreeObj =
  | Record<string, number>
  | Record<string, string>
  | Record<string, unknown>;

export type ObjDataEntry = {
  key: string;
  value: unknown;
};

export type ObjDataItem = {
  subTitle?: string;
  entries: ObjDataEntry[];
};

export type ObjDataAccordionGroup = {
  key: string;
  title: string;
  items: ObjDataItem[];
};

export function isThreeLikeObj(value: unknown): value is ThreeObj {
  if (value == null) return false;
  return typeof value === "object";
}

function objectToEntries(obj: unknown): ObjDataEntry[] {
  if (typeof obj !== "object" || obj === null) return [];
  return Object.entries(obj).map(([key, value]) => ({ key, value }));
}

const THREE_OBJ_TOP_KEYS = ["metadata", "geometries", "materials", "object"] as const;

export function extractThreeObjAccordionGroups(
  value: unknown
): ObjDataAccordionGroup[] {
  if (!isThreeLikeObj(value)) return [];

  const record = value as Record<string, unknown>;
  const groups: ObjDataAccordionGroup[] = [];
  console.log("value", value);

  for (const topKey of THREE_OBJ_TOP_KEYS) {
    const val = record[topKey];
    if (val === undefined) continue;

    let items: ObjDataItem[] = [];
    if (Array.isArray(val)) {
      items = val.map((item, i) => ({
        subTitle: String(i),
        entries: objectToEntries(item),
      }));
    } else if (typeof val === "object" && val !== null) {
      items = [{ entries: objectToEntries(val) }];
    }
    

    if (items.length > 0) {
      const title =
        topKey.charAt(0).toUpperCase() + topKey.slice(1);
      groups.push({
        key: `__threeObj.${topKey}`,
        title,
        items,
      });
    }
  }



  return groups;
}

