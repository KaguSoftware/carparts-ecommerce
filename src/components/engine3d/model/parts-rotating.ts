import { CylinderGeometry, LatheGeometry, Shape, TorusGeometry, Vector2, type BufferGeometry } from "three";
import { Batch, circlePath, placementMatrix, polygonShape, slabX, slabY, type MergedMesh } from "./batch";
import { CRANK, CYL_X, pinPosition, pistonPinY, rodTilt, throwAngle } from "./dims";

/** Reciprocating and rotating assembly: pistons with rings, connecting rods, crankshaft with counterweights. */

const cylX = (r: number, len: number, seg = 24): BufferGeometry => new CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2);

/* ------------------------------------------------------------------ pistons */

/** Piston profile, origin on the piston pin axis. Ring grooves are real notches in the lathe profile. */
const PISTON_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0, -0.3],
  [0.38, -0.3],
  [0.41, -0.27],
  [0.42, -0.2],
  [0.42, 0.03],
  [0.425, 0.05],
  [0.425, 0.07],
  [0.4, 0.07],
  [0.4, 0.1],
  [0.425, 0.1],
  [0.425, 0.13],
  [0.4, 0.13],
  [0.4, 0.16],
  [0.425, 0.16],
  [0.425, 0.19],
  [0.4, 0.19],
  [0.4, 0.22],
  [0.425, 0.22],
  [0.425, 0.29],
  [0.4, 0.31],
  [0.2, 0.31],
  [0, 0.285],
];

export function buildPistons(): MergedMesh[] {
  const b = new Batch();
  const body = new LatheGeometry(
    PISTON_PROFILE.map(([r, y]) => new Vector2(r, y)),
    32,
  );
  const ring = new TorusGeometry(0.412, 0.02, 6, 32).rotateX(Math.PI / 2);
  const pin = cylX(0.09, 0.84, 16);
  CYL_X.forEach((x, cyl) => {
    const y = pistonPinY(cyl);
    b.add("alu", body, { p: [x, y, 0] });
    for (const ry of [0.085, 0.145, 0.205]) b.add("steel", ring, { p: [x, y + ry, 0] });
    b.add("steel", pin, { p: [x, y, 0] });
  });
  return b.build();
}

/* --------------------------------------------------------------- connecting rods */

export function buildConrods(): MergedMesh[] {
  const b = new Batch();
  const L = CRANK.rodLen;

  const bigEnd = new Shape();
  bigEnd.absarc(0, 0, 0.27, 0, Math.PI * 2, false);
  bigEnd.holes.push(circlePath(0, 0, 0.2));
  const bigGeo = slabX(bigEnd, 0.28).translate(-0.14, 0, 0);

  const smallEnd = new Shape();
  smallEnd.absarc(0, L, 0.15, 0, Math.PI * 2, false);
  smallEnd.holes.push(circlePath(0, L, 0.095));
  const smallGeo = slabX(smallEnd, 0.26).translate(-0.13, 0, 0);

  // I-beam between the eyes (section in the XZ plane, extruded along Y).
  const beamLen = L - 0.27 - 0.13;
  const beam = polygonShape([
    [-0.08, -0.1],
    [0.08, -0.1],
    [0.08, -0.07],
    [0.025, -0.07],
    [0.025, 0.07],
    [0.08, 0.07],
    [0.08, 0.1],
    [-0.08, 0.1],
    [-0.08, 0.07],
    [-0.025, 0.07],
    [-0.025, -0.07],
    [-0.08, -0.07],
  ]);
  const beamGeo = slabY(beam, beamLen).translate(0, 0.25, 0);
  const bolt = new CylinderGeometry(0.04, 0.04, 0.12, 8);

  CYL_X.forEach((x, cyl) => {
    const pin = pinPosition(cyl);
    const m = placementMatrix({ p: [x, pin.y, pin.z], r: [rodTilt(cyl), 0, 0] });
    b.add("steel", bigGeo, m);
    b.add("steel", smallGeo, m);
    b.add("alu", beamGeo, m);
    for (const dx of [-0.11, 0.11]) b.add("darkSteel", bolt, placementMatrix({ p: [dx, -0.25, 0] }).premultiply(m));
  });
  return b.build();
}

/* ------------------------------------------------------------------ crankshaft */

const wrap = (a: number): number => {
  let v = a % (Math.PI * 2);
  if (v > Math.PI) v -= Math.PI * 2;
  if (v < -Math.PI) v += Math.PI * 2;
  return v;
};

/** Crank web: a disc around the main axis with a lobe around the pin and a heavy counterweight opposite it. */
function webGeometry(angle: number): BufferGeometry {
  const pts: Array<readonly [number, number]> = [];
  const steps = 72;
  for (let k = 0; k < steps; k++) {
    const psi = (k / steps) * Math.PI * 2;
    const dPin = wrap(psi - angle);
    const dCw = wrap(psi - angle - Math.PI);
    const rho = 0.36 + 0.34 * Math.exp(-((dPin / 0.5) ** 2)) + 0.4 * Math.exp(-((dCw / 1.0) ** 2));
    // psi runs from +Y toward +Z; the shape x axis is -Z.
    pts.push([-rho * Math.sin(psi), rho * Math.cos(psi)]);
  }
  return slabX(polygonShape(pts), 0.2);
}

export function buildCrankshaft(): MergedMesh[] {
  const b = new Batch();
  const journal = cylX(CRANK.mainR, 0.3, 28);
  for (const x of CRANK.journalX) b.add("steel", journal, { p: [x, 0, 0] });

  const crankPin = cylX(CRANK.pinR, 0.3, 28);
  CYL_X.forEach((x, cyl) => {
    const pin = pinPosition(cyl);
    b.add("steel", crankPin, { p: [x, pin.y, pin.z] });
    const web = webGeometry(throwAngle(cyl));
    b.add("darkSteel", web, { p: [x - 0.35, 0, 0] });
    b.add("darkSteel", web, { p: [x + 0.15, 0, 0] });
  });

  // Snout, damper pulley with an amber timing ring, rear flange with bolt circle.
  b.add("steel", cylX(0.17, 0.75, 20), { p: [-2.52, 0, 0] });
  b.add("darkSteel", cylX(0.4, 0.18, 36), { p: [-2.8, 0, 0] });
  b.add("amber", cylX(0.415, 0.04, 36), { p: [-2.74, 0, 0] });
  b.add("darkSteel", cylX(0.56, 0.12, 36), { p: [2.2, 0, 0] });
  b.add("steel", cylX(0.2, 0.2, 20), { p: [2.05, 0, 0] });
  const bolt = cylX(0.04, 0.09, 6);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.add("steel", bolt, { p: [2.29, 0.43 * Math.cos(a), 0.43 * Math.sin(a)] });
  }
  return b.build();
}
