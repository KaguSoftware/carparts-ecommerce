/**
 * Part registry for the engine teardown. Pure data: no three.js import, so the section, the SVG blueprint and the
 * legend can use it without pulling the 3D bundle.
 *
 * The `id` of every part is also the NODE NAME the 3D layer looks for (`scene.getObjectByName(id)`). A future .glb
 * only has to name its nodes after these ids to replace the procedural model (see ./README.md).
 */

export const PART_IDS = [
  "valveCover",
  "camshafts",
  "camGears",
  "rockerArms",
  "cylinderHead",
  "valves",
  "headGasket",
  "block",
  "pistons",
  "conrods",
  "crankshaft",
  "oilPan",
  "intakeManifold",
  "exhaustManifold",
  "timingChain",
] as const;

export type PartId = (typeof PART_IDS)[number];

export type Vec3 = readonly [x: number, y: number, z: number];

export interface PartDef {
  id: PartId;
  /** Shop category slug (seed categories: `engine` and its subcategories, `exhaust`, plus filter / fluid subcategories). */
  categorySlug: string;
  /**
   * Search term for parts that have no subcategory of their own (pistons, camshafts, ...). When set, the part links to
   * `/search?q=<term>` instead of the broad `engine` category, so a click lands on something specific.
   */
  searchTerm?: string;
  /** Exploded offset in model units (1 unit = 100 mm). The assembled position is the model's own origin. */
  explode: Vec3;
  /**
   * [start, end] of the part's move inside the 0..1 explode progress. The outermost parts lead and the ones nearer the
   * block follow, so a layer never moves into the one beyond it (each layer has a larger offset AND an earlier window
   * than the layer between it and the block).
   */
  window: readonly [number, number];
}

// Copy for every part lives under `engine3d.parts.<id>.{name,note,shop}`.
export const PARTS: readonly PartDef[] = [
  { id: "valveCover", categorySlug: "gaskets-seals", explode: [0, 5.4, 0], window: [0, 0.62] },
  { id: "camshafts", categorySlug: "engine", searchTerm: "camshaft", explode: [0, 4.5, 0], window: [0.06, 0.68] },
  { id: "camGears", categorySlug: "belts-timing", explode: [-1.0, 4.5, 0], window: [0.06, 0.68] },
  { id: "rockerArms", categorySlug: "engine", searchTerm: "rocker arm", explode: [0, 4.1, 0], window: [0.1, 0.72] },
  { id: "cylinderHead", categorySlug: "engine", searchTerm: "cylinder head", explode: [0, 3.6, 0], window: [0.16, 0.78] },
  { id: "valves", categorySlug: "engine", searchTerm: "valve", explode: [0, 3.2, 0], window: [0.2, 0.82] },
  { id: "headGasket", categorySlug: "gaskets-seals", explode: [0, 2.4, 0], window: [0.26, 0.86] },
  { id: "block", categorySlug: "engine", searchTerm: "engine block", explode: [0, 0, 0], window: [0, 1] },
  { id: "pistons", categorySlug: "engine", searchTerm: "piston", explode: [0, 1.9, 0], window: [0.32, 0.9] },
  { id: "conrods", categorySlug: "engine", searchTerm: "connecting rod", explode: [0, 1.1, 0], window: [0.36, 0.94] },
  { id: "crankshaft", categorySlug: "engine", searchTerm: "crankshaft", explode: [0, -1.0, 0], window: [0.12, 0.74] },
  { id: "oilPan", categorySlug: "engine-oil", explode: [0, -2.1, 0], window: [0, 0.62] },
  { id: "intakeManifold", categorySlug: "air-filters", explode: [0, 3.6, 4.5], window: [0.2, 0.8] },
  { id: "exhaustManifold", categorySlug: "exhaust", explode: [0, 3.6, -4.5], window: [0.2, 0.8] },
  { id: "timingChain", categorySlug: "belts-timing", explode: [-4.0, 2.2, 0], window: [0.15, 0.75] },
];

export const PART_BY_ID = Object.fromEntries(PARTS.map((p) => [p.id, p])) as Readonly<Record<PartId, PartDef>>;

/** Where a part leads in the shop: a search for the part when it has no subcategory, otherwise its subcategory. */
export function partHref(part: Pick<PartDef, "categorySlug" | "searchTerm">): string {
  return part.searchTerm ? `/search?q=${encodeURIComponent(part.searchTerm)}` : `/category/${part.categorySlug}`;
}

/** Drawing number of a part (`01`..`15`): the balloon on the blueprint and the prefix of its legend row. */
export function partNumber(id: PartId): string {
  return String(PART_IDS.indexOf(id) + 1).padStart(2, "0");
}

export function isPartId(value: string): value is PartId {
  return (PART_IDS as readonly string[]).includes(value);
}

/** What the section hands the 3D stage, without React state in the hot path. */
export interface StageBridge {
  /** Explode progress 0..1 (already shaped by the section: dwell at both ends). Written by the section on scroll. */
  progress: number;
  /** Set by the stage so the section can request a frame when `progress` changes (the stage renders on demand). */
  invalidate: (() => void) | null;
}
