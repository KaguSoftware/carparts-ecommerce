import { BoxGeometry, CylinderGeometry, type BufferGeometry } from "three";
import { Batch, circlePath, polygonShape, roundedRect, roundedRectPath, slabX, slabY, type MergedMesh } from "./batch";
import { BLOCK, BORE_R, CAM, CRANK, CYL_X, HEAD } from "./dims";

/** Static castings: block, head, head gasket, valve cover, oil pan. All built from extrusions of 2D outlines. */

const cylX = (r: number, len: number, seg = 24): BufferGeometry => new CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2);
const cylZ = (r: number, len: number, seg = 24): BufferGeometry => new CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2);
const cylY = (r: number, len: number, seg = 24): BufferGeometry => new CylinderGeometry(r, r, len, seg);
const box = (x: number, y: number, z: number): BufferGeometry => new BoxGeometry(x, y, z);

export function buildBlock(): MergedMesh[] {
  const b = new Batch();
  const len = BLOCK.halfLen * 2;
  const width = BLOCK.halfW * 2;

  // Cylinder section: outline with four bores, deck on top.
  const upper = roundedRect(len, width, 0.12);
  CYL_X.forEach((x) => upper.holes.push(circlePath(x, 0, BORE_R)));
  b.add("block", slabY(upper, BLOCK.deckY - BLOCK.upperY), { p: [0, BLOCK.upperY, 0] });

  // Crankcase skirt: a hollow shell so the crank stays visible once it drops out.
  const skirt = roundedRect(len, width, 0.12);
  skirt.holes.push(roundedRectPath(len - 0.3, width - 0.24, 0.15));
  b.add("block", slabY(skirt, BLOCK.upperY - BLOCK.skirtY), { p: [0, BLOCK.skirtY, 0] });

  // Main-bearing bulkheads with a journal bore each, plus matching outside ribs.
  const hw = BLOCK.halfW - 0.12;
  const bulkhead = polygonShape([
    [-hw, BLOCK.skirtY],
    [hw, BLOCK.skirtY],
    [hw, BLOCK.upperY],
    [-hw, BLOCK.upperY],
  ]);
  bulkhead.holes.push(circlePath(0, 0, CRANK.mainR + 0.03));
  const bulkheadGeo = slabX(bulkhead, 0.12);
  const ribGeo = box(0.1, 0.9, 0.07);
  for (const x of CRANK.journalX) {
    b.add("block", bulkheadGeo, { p: [x - 0.06, 0, 0] });
    for (const side of [-1, 1]) b.add("block", ribGeo, { p: [x, 0.0, side * (BLOCK.halfW + 0.03)] });
  }

  // Oil filter canister (bare aluminium, orange stays on the valve cover and cam gears), crank seal and rear main seal housing.
  b.add("steel", cylZ(0.34, 0.1), { p: [1.15, 0.15, BLOCK.halfW + 0.05] });
  b.add("alu", cylZ(0.29, 0.62), { p: [1.15, 0.15, BLOCK.halfW + 0.4] });
  b.add("darkSteel", cylX(0.36, 0.1), { p: [-BLOCK.halfLen - 0.05, 0, 0] });
  b.add("alu", cylX(0.5, 0.1), { p: [BLOCK.halfLen + 0.05, 0, 0] });
  return b.build();
}

export function buildCylinderHead(): MergedMesh[] {
  const b = new Batch();
  const height = HEAD.top - HEAD.bottom;
  b.add("head", slabY(roundedRect(BLOCK.halfLen * 2, BLOCK.halfW * 2, 0.12), height, { bevel: 0 }), { p: [0, HEAD.bottom, 0] });

  // Spark plug tubes between the cams.
  for (const x of CYL_X) {
    b.add("darkSteel", cylY(0.17, 0.5), { p: [x, HEAD.top + 0.1, 0] });
    b.add("amber", cylY(0.185, 0.04), { p: [x, HEAD.top + 0.33, 0] });
  }

  // Cam bearing saddles: five per camshaft.
  const saddle = box(0.26, 0.34, 0.4);
  for (const x of CRANK.journalX) {
    for (const z of [CAM.zIntake, CAM.zExhaust]) b.add("head", saddle, { p: [x, HEAD.top + 0.17, z] });
  }

  // Port bosses and studs: intake (+Z) larger than exhaust (-Z).
  for (const x of CYL_X) {
    b.add("head", cylZ(0.28, 0.1), { p: [x, 2.9, BLOCK.halfW + 0.04] });
    b.add("head", cylZ(0.22, 0.1), { p: [x, 2.9, -BLOCK.halfW - 0.04] });
  }
  const stud = cylZ(0.035, 0.26, 8);
  for (const x of CRANK.journalX) {
    for (const side of [-1, 1]) b.add("steel", stud, { p: [x, 2.9, side * (BLOCK.halfW + 0.1)] });
  }

  // Coolant outlet and rear cam seal boss.
  b.add("alu", cylX(0.22, 0.32), { p: [BLOCK.halfLen + 0.16, 3.0, 0.3] });
  b.add("darkSteel", cylX(0.15, 0.1), { p: [BLOCK.halfLen + 0.05, CAM.y, CAM.zIntake] });
  b.add("darkSteel", cylX(0.15, 0.1), { p: [BLOCK.halfLen + 0.05, CAM.y, CAM.zExhaust] });
  return b.build();
}

export function buildHeadGasket(): MergedMesh[] {
  const b = new Batch();
  const plate = roundedRect(BLOCK.halfLen * 2, BLOCK.halfW * 2, 0.12);
  CYL_X.forEach((x) => plate.holes.push(circlePath(x, 0, BORE_R + 0.01)));
  // Coolant and oil passages between and beside the bores.
  for (const x of [-2, -1, 0, 1, 2]) for (const z of [-0.78, 0.78]) plate.holes.push(circlePath(x, z, 0.055));
  b.add("gasket", slabY(plate, 0.035), { p: [0, BLOCK.deckY, 0] });

  // Combustion seal beads around every bore.
  const outer = BORE_R + 0.085;
  const ringShape = polygonShape(Array.from({ length: 48 }, (_, i) => [Math.cos((i / 48) * Math.PI * 2) * outer, Math.sin((i / 48) * Math.PI * 2) * outer] as const));
  ringShape.holes.push(circlePath(0, 0, BORE_R + 0.01));
  const bead = slabY(ringShape, 0.05);
  for (const x of CYL_X) b.add("amber", bead, { p: [x, BLOCK.deckY - 0.005, 0] });
  return b.build();
}

export function buildValveCover(): MergedMesh[] {
  const b = new Batch();
  const len = BLOCK.halfLen * 2 - 0.04;
  const width = BLOCK.halfW * 2 - 0.04;
  const wallH = 0.62;
  const wall = roundedRect(len, width, 0.16);
  wall.holes.push(roundedRectPath(len - 0.14, width - 0.14, 0.1));
  b.add("cover", slabY(wall, wallH), { p: [0, HEAD.top, 0] });
  // Domed top.
  b.add("cover", slabY(roundedRect(len - 0.16, width - 0.16, 0.12), 0.02, { bevel: 0.08 }), { p: [0, HEAD.top + wallH + 0.01, 0] });

  const topY = HEAD.top + wallH + 0.11;
  // Raised spines, plug wells, oil cap, rim bolts.
  for (const z of [-0.55, 0.55]) b.add("pan", box(3.5, 0.05, 0.1), { p: [0, topY, z] });
  for (const x of CYL_X) {
    b.add("darkSteel", cylY(0.22, 0.12, 28), { p: [x, topY + 0.04, 0] });
    b.add("pan", cylY(0.15, 0.13, 20), { p: [x, topY + 0.05, 0] });
  }
  b.add("amber", cylY(0.2, 0.1, 28), { p: [-1.55, topY + 0.03, 0.62] });
  const bolt = cylY(0.06, 0.05, 6);
  for (const x of CRANK.journalX) for (const z of [-0.8, 0.8]) b.add("steel", bolt, { p: [x, topY - 0.03, z] });
  b.add("darkSteel", slabY(wall, 0.05), { p: [0, HEAD.top, 0] });
  return b.build();
}

export function buildOilPan(): MergedMesh[] {
  const b = new Batch();
  const len = BLOCK.halfLen * 2;
  const width = BLOCK.halfW * 2;
  const top = BLOCK.skirtY;

  const flange = roundedRect(len, width, 0.12);
  flange.holes.push(roundedRectPath(len - 0.5, width - 0.4, 0.1));
  b.add("pan", slabY(flange, 0.1), { p: [0, top - 0.1, 0] });

  const wall = roundedRect(len - 0.24, width - 0.24, 0.22);
  wall.holes.push(roundedRectPath(len - 0.4, width - 0.4, 0.16));
  b.add("pan", slabY(wall, 0.85), { p: [0, top - 0.95, 0] });
  b.add("pan", slabY(roundedRect(len - 0.62, width - 0.62, 0.2), 0.04, { bevel: 0.14 }), { p: [0, top - 1.07, 0] });

  const rib = box(0.08, 0.72, 0.05);
  for (const x of CRANK.journalX) for (const side of [-1, 1]) b.add("pan", rib, { p: [x, top - 0.58, side * (width / 2 - 0.1)] });
  const bolt = cylY(0.05, 0.05, 6);
  for (let i = 0; i < 7; i++) for (const side of [-1, 1]) b.add("steel", bolt, { p: [-1.8 + i * 0.6, top - 0.11, side * (width / 2 - 0.07)] });
  b.add("steel", cylY(0.1, 0.1, 6), { p: [-1.0, top - 1.2, 0] });
  return b.build();
}
