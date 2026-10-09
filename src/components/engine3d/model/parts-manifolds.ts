import { BoxGeometry, CatmullRomCurve3, CylinderGeometry, TubeGeometry, Vector3, type BufferGeometry } from "three";
import { Batch, roundedRect, slabX, type MergedMesh } from "./batch";
import { BLOCK, CYL_X } from "./dims";

const cylX = (r: number, len: number, seg = 24): BufferGeometry => new CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2);
const cylY = (r: number, len: number, seg = 24): BufferGeometry => new CylinderGeometry(r, r, len, seg);
const cylZ = (r: number, len: number, seg = 24): BufferGeometry => new CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2);

const tube = (points: Array<[number, number, number]>, radius: number): BufferGeometry =>
  new TubeGeometry(new CatmullRomCurve3(points.map(([x, y, z]) => new Vector3(x, y, z)), false, "catmullrom", 0.5), 40, radius, 14);

const FACE = BLOCK.halfW + 0.04;
/** Flange plates are thin and sit on the block side; everything else grows outward from them. */
const PLATE = 0.05;
const BOLT_X = [-2, -1, 0, 1, 2] as const;

export function buildIntakeManifold(): MergedMesh[] {
  const b = new Batch();
  // Thin flange on the head face, with a row of bolt heads between the ports.
  b.add("darkSteel", new BoxGeometry(4.0, 0.62, PLATE), { p: [0, 2.9, FACE] });
  for (const x of BOLT_X) b.add("steel", cylZ(0.05, 0.06, 6), { p: [x, 2.9, FACE + 0.05] });

  // Plenum: a cast tank with a rounded-rectangle section (not a pill), ribbed on top.
  b.add("manifold", slabX(roundedRect(1.1, 0.92, 0.3), 3.4, { bevel: 0.04 }), { p: [-1.7, 3.4, 2.15] });
  for (const x of [-1.1, 0, 1.1]) b.add("darkSteel", new BoxGeometry(0.1, 0.05, 0.72), { p: [x, 3.88, 2.15] });

  // Four runners leave the plenum's engine-facing wall through cast trumpets and run down to the flange.
  for (const x of CYL_X) {
    b.add("manifold", tube([[x, 2.9, FACE + PLATE / 2], [x, 2.92, 1.35], [x, 3.04, 1.55], [x, 3.22, 1.66]], 0.2));
    b.add("darkSteel", cylZ(0.27, 0.16, 24), { p: [x, 3.22, 1.64] });
    // Injector body plugged into the runner, fed by the rail.
    b.add("alu", cylY(0.07, 0.34, 12), { p: [x, 3.24, 1.34] });
  }
  b.add("steel", cylX(0.05, 3.9, 10), { p: [0, 3.42, 1.34] });

  // Throttle body on the plenum end: flange, barrel, collar and blade.
  b.add("darkSteel", cylX(0.4, 0.08, 28), { p: [1.78, 3.4, 2.15] });
  b.add("alu", cylX(0.32, 0.7, 28), { p: [2.15, 3.4, 2.15] });
  b.add("amber", cylX(0.355, 0.06, 28), { p: [2.42, 3.4, 2.15] });
  b.add("darkSteel", cylX(0.27, 0.03, 24), { p: [2.55, 3.4, 2.15] });
  return b.build();
}

export function buildExhaustManifold(): MergedMesh[] {
  const b = new Batch();
  // Thin flange on the head face; the runners and collector grow away from it.
  b.add("darkSteel", new BoxGeometry(4.0, 0.58, PLATE), { p: [0, 2.9, -FACE] });
  for (const x of BOLT_X) b.add("steel", cylZ(0.05, 0.06, 6), { p: [x, 2.9, -FACE - 0.05] });

  // Four primaries merging into one collector below the head.
  for (const x of CYL_X) {
    b.add("darkSteel", cylZ(0.2, 0.1, 24), { p: [x, 2.9, -FACE - 0.07] });
    b.add("exhaust", tube([[x, 2.9, -FACE], [x, 2.88, -1.4], [x * 0.6, 2.5, -1.85], [x * 0.2, 2.0, -2.1], [x * 0.05, 1.7, -2.15]], 0.14));
  }
  b.add("exhaust", new CylinderGeometry(0.34, 0.2, 0.55, 24), { p: [0, 1.5, -2.15] });
  b.add("exhaust", cylY(0.2, 0.7, 24), { p: [0, 0.95, -2.15] });
  b.add("darkSteel", cylY(0.34, 0.06, 24), { p: [0, 0.6, -2.15] });
  const bolt = cylY(0.035, 0.1, 6);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    b.add("steel", bolt, { p: [0.27 * Math.cos(a), 0.6, -2.15 + 0.27 * Math.sin(a)] });
  }
  // Oxygen sensor boss on the collector (amber collar).
  b.add("amber", cylY(0.07, 0.08, 12), { p: [0.3, 1.6, -2.15], r: [0, 0, -0.8] });
  return b.build();
}
