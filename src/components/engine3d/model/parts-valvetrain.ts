import { BoxGeometry, Curve, CylinderGeometry, LatheGeometry, Shape, TubeGeometry, Vector2, Vector3, type BufferGeometry } from "three";
import { Batch, circlePath, placementMatrix, polygonShape, slabX, type MergedMesh } from "./batch";
import { CAM, CRANK, CYL_X, VALVE } from "./dims";

/** Valvetrain: camshafts with VTEC lobes, cam gears, rocker arms, valves with springs, timing chain. */

const cylX = (r: number, len: number, seg = 24): BufferGeometry => new CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2);

const wrap = (a: number): number => {
  let v = a % (Math.PI * 2);
  if (v > Math.PI) v -= Math.PI * 2;
  if (v < -Math.PI) v += Math.PI * 2;
  return v;
};

type P2 = readonly [number, number];

/** Convex hull (Andrew monotone chain), counter-clockwise. */
function convexHull(points: P2[]): P2[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: P2, a: P2, b: P2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: P2[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: P2[] = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function circlePoints(cx: number, cy: number, r: number, n = 40): P2[] {
  return Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * Math.PI * 2), cy + r * Math.sin((i / n) * Math.PI * 2)] as const);
}

/* ------------------------------------------------------------------- camshafts */

function lobeGeometry(base: number, nose: number): BufferGeometry {
  const pts: P2[] = [];
  const steps = 56;
  for (let k = 0; k < steps; k++) {
    const t = (k / steps) * Math.PI * 2;
    const rho = base + (nose - base) * Math.exp(-((wrap(t) / 0.62) ** 2));
    pts.push([-rho * Math.sin(t), rho * Math.cos(t)]);
  }
  return slabX(polygonShape(pts), 0.16).translate(-0.08, 0, 0);
}

export function buildCamshafts(): MergedMesh[] {
  const b = new Batch();
  const shaft = cylX(0.1, 4.85, 20);
  const journal = cylX(0.13, 0.24, 20);
  const lowLobe = lobeGeometry(0.17, 0.3);
  const vtecLobe = lobeGeometry(0.17, 0.37);
  // Firing order 1-3-4-2: cam phase per cylinder, exhaust cam leads by 40 degrees.
  const phase = [0, (3 * Math.PI) / 2, Math.PI / 2, Math.PI];
  for (const [z, kind] of [
    [CAM.zIntake, "intake"],
    [CAM.zExhaust, "exhaust"],
  ] as const) {
    b.add("steel", shaft, { p: [-0.125, CAM.y, z] });
    for (const x of CRANK.journalX) b.add("steel", journal, { p: [x, CAM.y, z] });
    CYL_X.forEach((x, cyl) => {
      const rot = phase[cyl] + (kind === "exhaust" ? 0.7 : 0);
      b.add("darkSteel", lowLobe, { p: [x - 0.26, CAM.y, z], r: [rot, 0, 0] });
      b.add("darkSteel", lowLobe, { p: [x + 0.26, CAM.y, z], r: [rot, 0, 0] });
      if (kind === "intake") b.add("amber", vtecLobe, { p: [x, CAM.y, z], r: [rot, 0, 0] });
    });
    b.add("darkSteel", cylX(0.2, 0.06, 24), { p: [2.25, CAM.y, z] });
  }
  return b.build();
}

/* ------------------------------------------------------------------ cam gears */

function toothedGeometry(rTip: number, rRoot: number, teeth: number, depth: number, holes: number, holeRadius: number, holeAt: number): BufferGeometry {
  const pts: P2[] = [];
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const step = (Math.PI * 2) / teeth;
    pts.push([rRoot * Math.cos(a0), rRoot * Math.sin(a0)]);
    pts.push([rTip * Math.cos(a0 + step * 0.2), rTip * Math.sin(a0 + step * 0.2)]);
    pts.push([rTip * Math.cos(a0 + step * 0.5), rTip * Math.sin(a0 + step * 0.5)]);
    pts.push([rRoot * Math.cos(a0 + step * 0.7), rRoot * Math.sin(a0 + step * 0.7)]);
  }
  const shape: Shape = polygonShape(pts);
  for (let i = 0; i < holes; i++) {
    const a = (i / holes) * Math.PI * 2;
    shape.holes.push(circlePath(holeAt * Math.cos(a), holeAt * Math.sin(a), holeRadius));
  }
  return slabX(shape, depth);
}

const GEAR_X = CAM.frontX - 0.06;
const CAM_GEAR_TIP = 0.38;
const CRANK_SPROCKET_TIP = 0.3;

export function buildCamGears(): MergedMesh[] {
  const b = new Batch();
  const gear = toothedGeometry(CAM_GEAR_TIP, 0.34, 26, 0.12, 5, 0.06, 0.26);
  const bolt = cylX(0.03, 0.05, 8);
  for (const [z, hub] of [
    [CAM.zIntake, "orange"],
    [CAM.zExhaust, "darkSteel"],
  ] as const) {
    b.add("darkSteel", gear, { p: [GEAR_X, CAM.y, z] });
    // Intake gear carries the variable-timing actuator, exhaust gear a plain hub.
    b.add(hub, cylX(hub === "orange" ? 0.22 : 0.17, hub === "orange" ? 0.2 : 0.14, 28), { p: [GEAR_X - 0.1, CAM.y, z] });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      b.add("steel", bolt, { p: [GEAR_X - 0.21, CAM.y + 0.12 * Math.cos(a), z + 0.12 * Math.sin(a)] });
    }
  }
  return b.build();
}

/* ------------------------------------------------------------------ rocker arms */

function rockerGeometry(side: 1 | -1, padZ: number, padY: number, padR: number): BufferGeometry {
  const pivot = { z: 0.85, y: 3.5, r: 0.09 };
  const pts = convexHull([...circlePoints(side * pivot.z, pivot.y, pivot.r, 20), ...circlePoints(side * padZ, padY, padR, 20)]);
  // Shape x is -Z.
  return slabX(polygonShape(pts.map(([z, y]) => [-z, y] as const)), 0.18).translate(-0.09, 0, 0);
}

export function buildRockerArms(): MergedMesh[] {
  const b = new Batch();
  const roller = cylX(0.075, 0.17, 20);
  const rollerBig = cylX(0.095, 0.17, 20);
  for (const side of [1, -1] as const) {
    const main = rockerGeometry(side, VALVE.tipZ, 3.53, 0.075);
    const free = rockerGeometry(side, 0.46, 3.6, 0.09);
    // Rocker shaft.
    b.add("steel", cylX(0.058, 4.2, 14), { p: [0, 3.5, side * 0.85] });
    CYL_X.forEach((x) => {
      for (const dx of [-VALVE.dx, VALVE.dx]) {
        b.add("alu", main, { p: [x + dx, 0, 0] });
        b.add("steel", roller, { p: [x + dx, 3.6, side * 0.45] });
      }
      if (side === 1) {
        // VTEC middle rocker: free-floating until the lock pin couples it.
        b.add("amber", free, { p: [x, 0, 0] });
        b.add("steel", rollerBig, { p: [x, 3.64, side * 0.45] });
      }
    });
  }
  return b.build();
}

/* ----------------------------------------------------------------------- valves */

class Helix extends Curve<Vector3> {
  constructor(
    private readonly radius: number,
    private readonly y0: number,
    private readonly y1: number,
    private readonly turns: number,
  ) {
    super();
  }
  override getPoint(t: number, target = new Vector3()): Vector3 {
    const a = t * this.turns * Math.PI * 2;
    return target.set(this.radius * Math.cos(a), this.y0 + (this.y1 - this.y0) * t, this.radius * Math.sin(a));
  }
}

function valveGeometry(headR: number): BufferGeometry {
  const L = VALVE.length;
  const profile: Array<readonly [number, number]> = [
    [0, -L],
    [headR, -L],
    [headR, -L + 0.03],
    [headR - 0.012, -L + 0.06],
    [0.06, -L + 0.14],
    [0.035, -L + 0.2],
    [0.035, 0],
    [0, 0],
  ];
  return new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y)),
    20,
  );
}

export function buildValves(): MergedMesh[] {
  const b = new Batch();
  const intake = valveGeometry(0.19);
  const exhaust = valveGeometry(0.165);
  const spring = new TubeGeometry(new Helix(0.1, -0.14, -0.55, 7), 84, 0.014, 5);
  const retainer = new CylinderGeometry(0.11, 0.11, 0.04, 16).translate(0, -0.12, 0);
  const keeper = new CylinderGeometry(0.05, 0.065, 0.1, 10).translate(0, -0.05, 0);
  const tilt = (VALVE.tiltDeg * Math.PI) / 180;

  for (const side of [1, -1] as const) {
    for (const x of CYL_X) {
      for (const dx of [-VALVE.dx, VALVE.dx]) {
        const m = placementMatrix({ p: [x + dx, VALVE.tipY, side * VALVE.tipZ], r: [side * tilt, 0, 0] });
        b.add("steel", side === 1 ? intake : exhaust, m);
        b.add("amber", spring, m);
        b.add("darkSteel", retainer, m);
        b.add("darkSteel", keeper, m);
      }
    }
  }
  return b.build();
}

/* ----------------------------------------------------------------- timing chain */

export function buildTimingChain(): MergedMesh[] {
  const b = new Batch();
  const x = GEAR_X + 0.06;
  const sprocket = toothedGeometry(CRANK_SPROCKET_TIP, 0.26, 20, 0.12, 0, 0, 0);
  b.add("darkSteel", sprocket, { p: [GEAR_X, 0, 0] });
  b.add("steel", cylX(0.12, 0.2, 20), { p: [GEAR_X - 0.04, 0, 0] });

  // Chain path: hull around both cam gears and the crank sprocket, links spaced evenly along it.
  const clearance = 0.025;
  const hull = convexHull([
    ...circlePoints(CAM.zIntake, CAM.y, CAM_GEAR_TIP + clearance),
    ...circlePoints(CAM.zExhaust, CAM.y, CAM_GEAR_TIP + clearance),
    ...circlePoints(0, 0, CRANK_SPROCKET_TIP + clearance),
  ]);
  const edges = hull.map((p, i) => {
    const q = hull[(i + 1) % hull.length];
    return { p, q, len: Math.hypot(q[0] - p[0], q[1] - p[1]) };
  });
  const total = edges.reduce((sum, e) => sum + e.len, 0);
  const count = Math.round(total / 0.082);
  const step = total / count;

  // One chain link: width along X, radial thickness along Y, pitch along Z.
  const linkGeo = new BoxGeometry(0.11, 0.034, 0.064);
  let edge = 0;
  let into = 0;
  for (let i = 0; i < count; i++) {
    const e = edges[edge];
    const u = into / e.len;
    const z = e.p[0] + (e.q[0] - e.p[0]) * u;
    const y = e.p[1] + (e.q[1] - e.p[1]) * u;
    const tz = (e.q[0] - e.p[0]) / e.len;
    const ty = (e.q[1] - e.p[1]) / e.len;
    b.add(i % 2 === 0 ? "chain" : "darkSteel", linkGeo, { p: [x, y, z], r: [Math.atan2(-ty, tz), 0, 0] });
    into += step;
    while (edge < edges.length - 1 && into > edges[edge].len) {
      into -= edges[edge].len;
      edge++;
    }
  }
  return b.build();
}
