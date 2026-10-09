import { BufferGeometry, Euler, Matrix4, Quaternion, Shape, ExtrudeGeometry, Path, Vector3 } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { MatKey } from "./materials";

export type Vec3Tuple = readonly [number, number, number];

export interface Placement {
  /** Translation. */
  p?: Vec3Tuple;
  /** Euler rotation in radians (XYZ). */
  r?: Vec3Tuple;
  /** Uniform or per-axis scale. */
  s?: number | Vec3Tuple;
}

export interface MergedMesh {
  mat: MatKey;
  geometry: BufferGeometry;
}

const scratchQ = new Quaternion();
const scratchE = new Euler();
const scratchP = new Vector3();
const scratchS = new Vector3();

export function placementMatrix({ p = [0, 0, 0], r = [0, 0, 0], s = 1 }: Placement = {}): Matrix4 {
  scratchE.set(r[0], r[1], r[2], "XYZ");
  scratchQ.setFromEuler(scratchE);
  scratchP.set(p[0], p[1], p[2]);
  if (typeof s === "number") scratchS.set(s, s, s);
  else scratchS.set(s[0], s[1], s[2]);
  return new Matrix4().compose(scratchP, scratchQ, scratchS);
}

/**
 * Collects primitives per material and merges each bucket into ONE geometry. A part with 200 small primitives
 * therefore renders in a handful of draw calls, and the hover highlight has one mesh per material to touch.
 */
export class Batch {
  private readonly buckets = new Map<MatKey, BufferGeometry[]>();

  add(mat: MatKey, source: BufferGeometry, place?: Placement | Matrix4): this {
    const geometry = source.index ? source.toNonIndexed() : source.clone();
    for (const name of Object.keys(geometry.attributes)) {
      if (name !== "position" && name !== "normal" && name !== "uv") geometry.deleteAttribute(name);
    }
    geometry.clearGroups();
    geometry.applyMatrix4(place instanceof Matrix4 ? place : placementMatrix(place));
    const list = this.buckets.get(mat) ?? [];
    list.push(geometry);
    this.buckets.set(mat, list);
    return this;
  }

  build(): MergedMesh[] {
    const out: MergedMesh[] = [];
    for (const [mat, list] of this.buckets) {
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      out.push({ mat, geometry: merged });
    }
    return out;
  }
}

/* ---------------------------------------------------------------- 2D helpers */

export function roundedRect(w: number, h: number, r: number): Shape {
  const x = -w / 2;
  const y = -h / 2;
  const s = new Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

export function roundedRectPath(w: number, h: number, r: number, cx = 0, cy = 0): Path {
  const p = new Path();
  const x = cx - w / 2;
  const y = cy - h / 2;
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y);
  p.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  p.lineTo(x + w, y + h - r);
  p.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  p.lineTo(x + r, y + h);
  p.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  p.lineTo(x, y + r);
  p.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return p;
}

export function circlePath(cx: number, cy: number, r: number): Path {
  const p = new Path();
  p.absarc(cx, cy, r, 0, Math.PI * 2, true);
  return p;
}

/** Closed polygon through (x, y) points. */
export function polygonShape(points: ReadonlyArray<readonly [number, number]>): Shape {
  const s = new Shape();
  points.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  return s;
}

export interface ExtrudeOpts {
  bevel?: number;
  curveSegments?: number;
}

/**
 * Extrudes a 2D shape that lives in the world XZ plane up along +Y from y = 0 to y = height
 * (shape x -> world x, shape y -> world -z). Bevels grow the part by `bevel` on every face.
 */
export function slabY(shape: Shape, height: number, { bevel = 0, curveSegments = 24 }: ExtrudeOpts = {}): BufferGeometry {
  const g = new ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments,
  });
  g.rotateX(-Math.PI / 2);
  return g;
}

/**
 * Extrudes a 2D shape that lives in the world (z, y) plane along X from x = 0 to x = depth
 * (shape x -> world -z, shape y -> world y).
 */
export function slabX(shape: Shape, depth: number, { bevel = 0, curveSegments = 24 }: ExtrudeOpts = {}): BufferGeometry {
  const g = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments,
  });
  g.rotateY(Math.PI / 2);
  return g;
}
