/**
 * Part illustrations, group A: brakes, engine, suspension, filters.
 * Each function draws into a 400 x 400 box centred on (0, 0) and returns SVG markup.
 */
import { circle, ellipse, g, hexagon, line, outline, path, polygon, rect, ring, type Attrs, type Palette } from "./svg";

export interface Ctx {
  P: Palette;
  /** small deterministic integer derived from the product (0..2^31) for geometry variants */
  n: number;
}

const O = (c: Ctx, w = 2.2): Attrs => outline(c.P, w);
const pick = <T>(c: Ctx, items: readonly T[], salt = 0): T => items[(c.n + salt) % items.length] as T;

/* ------------------------------------------------------------------ brakes */

function padShape(c: Ctx): string {
  const { P } = c;
  return g([
    path("M -158 20 Q 0 -80 158 20 L 148 44 Q 0 -52 -148 44 Z", { fill: "url(#gm)", ...O(c) }),
    rect(-166, 22, 14, 14, { rx: 3, fill: "url(#gm)", ...O(c, 1.8), transform: "rotate(-14 -159 29)" }),
    rect(152, 22, 14, 14, { rx: 3, fill: "url(#gm)", ...O(c, 1.8), transform: "rotate(14 159 29)" }),
    path("M -148 44 Q 0 -52 148 44 L 136 98 Q 0 2 -136 98 Z", { fill: "url(#gd)", ...O(c) }),
    path("M -136 98 Q 0 2 136 98", { fill: "none", stroke: P.accent, "stroke-width": 5, "stroke-linecap": "round" }),
    rect(-5, -2, 10, 52, { fill: P.stroke, opacity: 0.8 }),
    path("M -90 46 Q -88 70 -92 84 M 90 46 Q 88 70 92 84", { fill: "none", stroke: P.stroke, "stroke-width": 3, opacity: 0.6 }),
    circle(-120, 30, 4, { fill: P.stroke, opacity: 0.55 }),
    circle(120, 30, 4, { fill: P.stroke, opacity: 0.55 }),
  ]);
}

export const pad = (c: Ctx) =>
  g([g(padShape(c), { transform: "translate(-14 -78) rotate(-5)", opacity: 0.88 }), g(padShape(c), { transform: "translate(10 38) rotate(1)" })]);

/** Annular sector (angles in degrees, clockwise on screen). */
function sector(r1: number, r2: number, a1: number, a2: number): string {
  const p = (r: number, a: number) => `${(r * Math.cos((a * Math.PI) / 180)).toFixed(2)} ${(r * Math.sin((a * Math.PI) / 180)).toFixed(2)}`;
  return `M ${p(r2, a1)} A ${r2} ${r2} 0 0 1 ${p(r2, a2)} L ${p(r1, a2)} A ${r1} ${r1} 0 0 0 ${p(r1, a1)} Z`;
}

export function shoe(c: Ctx): string {
  const { P } = c;
  const one = (a1: number, a2: number) => {
    const mid = (a1 + a2) / 2;
    return g([
      path(sector(138, 162, a1, a2), { fill: "url(#gd)", ...O(c) }),
      path(sector(122, 138, a1 + 3, a2 - 3), { fill: "url(#gm)", ...O(c) }),
      path(sector(60, 124, mid - 22, mid + 22), { fill: "url(#gm)", ...O(c) }),
      path(sector(139, 141, a1 + 6, a2 - 6), { fill: P.accent }),
      circle(98 * Math.cos((mid * Math.PI) / 180), 98 * Math.sin((mid * Math.PI) / 180), 9, { fill: P.rubber, ...O(c, 1.6) }),
    ]);
  };
  const spring = (x1: number, y1: number, x2: number, y2: number) => {
    const n = 7;
    const pts = Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n;
      const off = i === 0 || i === n ? 0 : i % 2 ? -5 : 5;
      return `${(x1 + (x2 - x1) * t).toFixed(1)} ${(y1 + (y2 - y1) * t + off).toFixed(1)}`;
    });
    return path(`M ${pts.join(" L ")}`, { fill: "none", stroke: P.steel, "stroke-width": 3, "stroke-linejoin": "round" });
  };
  const px = (r: number, a: number) => [r * Math.cos((a * Math.PI) / 180), r * Math.sin((a * Math.PI) / 180)] as const;
  const [tlx, tly] = px(130, 242);
  const [trx, try_] = px(130, 298);
  const [blx, bly] = px(130, 118);
  const [brx, bry] = px(130, 62);
  return g([
    circle(0, 0, 176, { fill: "url(#gdisc)", opacity: 0.4, ...O(c, 1.6) }),
    circle(0, 0, 40, { fill: "url(#gm)", ...O(c) }),
    ...ring(0, 0, 22, 5).map(([x, y]) => circle(x, y, 5, { fill: P.rubber })),
    one(122, 238),
    one(-58, 58),
    spring(tlx, tly, trx, try_),
    spring(blx, bly, brx, bry),
  ]);
}

export function disc(c: Ctx, slotted = false): string {
  const { P } = c;
  const bolts = 5;
  const parts: string[] = [
    circle(0, 0, 176, { fill: "url(#gdisc)", ...O(c, 2.6) }),
    circle(0, 0, 112, { fill: "none", stroke: P.metalLo, "stroke-width": 2, opacity: 0.7 }),
    circle(0, 0, 104, { fill: "url(#gm)", ...O(c) }),
    circle(0, 0, 100, { fill: "none", stroke: P.accent, "stroke-width": 4 }),
    circle(0, 0, 36, { fill: P.rubber, ...O(c) }),
    circle(0, 0, 30, { fill: "none", stroke: P.metalLo, "stroke-width": 2 }),
  ];
  for (const [x, y] of ring(0, 0, 66, bolts)) {
    parts.push(circle(x, y, 12, { fill: P.rubber, ...O(c, 1.8) }), circle(x - 2, y - 2, 4, { fill: P.metalHi, opacity: 0.5 }));
  }
  // friction ring texture: fine concentric grooves
  for (const r of [122, 134, 146, 158, 168]) parts.push(circle(0, 0, r, { fill: "none", stroke: P.metalLo, "stroke-width": 0.8, opacity: 0.45 }));
  if (slotted) {
    for (const [x, y] of ring(0, 0, 138, 24)) parts.push(circle(x, y, 5, { fill: P.rubber, stroke: P.stroke, "stroke-width": 1 }));
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI * 2) / 12;
      const p1 = [Math.cos(a) * 120, Math.sin(a) * 120];
      const p2 = [Math.cos(a + 0.35) * 168, Math.sin(a + 0.35) * 168];
      parts.push(path(`M ${p1[0]} ${p1[1]} Q ${Math.cos(a + 0.12) * 150} ${Math.sin(a + 0.12) * 150} ${p2[0]} ${p2[1]}`, { fill: "none", stroke: P.stroke, "stroke-width": 4, "stroke-linecap": "round", opacity: 0.8 }));
    }
  } else {
    for (const [x, y] of ring(0, 0, 144, 18, -Math.PI / 2 + 0.1)) parts.push(rect(x - 2, y - 9, 4, 18, { rx: 2, fill: P.rubber, opacity: 0.5, transform: `rotate(${(Math.atan2(y, x) * 180) / Math.PI + 90} ${x} ${y})` }));
  }
  parts.push(path("M -120 -110 A 160 160 0 0 1 -30 -168", { fill: "none", stroke: P.metalHi, "stroke-width": 6, "stroke-linecap": "round", opacity: 0.7 }));
  return g(parts);
}

export function caliper(c: Ctx): string {
  const { P } = c;
  return g([
    rect(-150, -88, 300, 176, { rx: 34, fill: "url(#ga)", ...O(c, 2.6) }),
    rect(-92, -52, 184, 104, { rx: 18, fill: "url(#gd)", ...O(c) }),
    circle(-52, 0, 40, { fill: "url(#gm)", ...O(c) }),
    circle(52, 0, 40, { fill: "url(#gm)", ...O(c) }),
    circle(-52, 0, 26, { fill: "none", stroke: P.metalLo, "stroke-width": 2 }),
    circle(52, 0, 26, { fill: "none", stroke: P.metalLo, "stroke-width": 2 }),
    rect(-18, -88, 36, 26, { rx: 4, fill: "url(#gm)", ...O(c, 1.8) }),
    rect(-8, -112, 16, 28, { rx: 3, fill: "url(#gm)", ...O(c, 1.8) }),
    circle(-124, -58, 12, { fill: P.rubber, ...O(c, 1.8) }),
    circle(124, -58, 12, { fill: P.rubber, ...O(c, 1.8) }),
    circle(-124, 58, 12, { fill: P.rubber, ...O(c, 1.8) }),
    circle(124, 58, 12, { fill: P.rubber, ...O(c, 1.8) }),
    path("M -130 -70 Q 0 -96 130 -70", { fill: "none", stroke: P.accentHi, "stroke-width": 4, opacity: 0.7, "stroke-linecap": "round" }),
    rect(-60, 66, 120, 12, { rx: 6, fill: P.paper, opacity: 0.85 }),
  ]);
}

export function hose(c: Ctx): string {
  const { P } = c;
  const d = "M -160 70 C -120 -120 20 -150 70 -30 S 150 100 168 20";
  const braid = [path(d, { fill: "none", stroke: P.stroke, "stroke-width": 26, "stroke-linecap": "round" }), path(d, { fill: "none", stroke: "url(#gm)", "stroke-width": 20, "stroke-linecap": "round" }), path(d, { fill: "none", stroke: P.steel, "stroke-width": 20, "stroke-dasharray": "3 6", opacity: 0.8 }), path(d, { fill: "none", stroke: P.metalHi, "stroke-width": 5, opacity: 0.6, transform: "translate(0 -5)" })];
  return g([
    ...braid,
    // banjo end
    circle(-166, 74, 30, { fill: "url(#gm)", ...O(c) }),
    circle(-166, 74, 13, { fill: P.rubber, ...O(c, 1.8) }),
    // threaded end
    rect(150, 6, 44, 28, { rx: 4, fill: "url(#ga)", ...O(c) }),
    rect(190, 10, 18, 20, { rx: 3, fill: "url(#gm)", ...O(c, 1.8) }),
  ]);
}

export function sensor(c: Ctx): string {
  const { P } = c;
  return g(
    [
      path("M -150 -14 L -108 -24 L -108 24 L -150 14 Z", { fill: "url(#gm)", ...O(c) }),
      rect(-108, -34, 118, 68, { rx: 10, fill: "url(#gh)", ...O(c) }),
      rect(-70, -34, 14, 68, { fill: "url(#ga)", ...O(c, 1.4) }),
      rect(-40, -34, 6, 68, { fill: P.metalLo, opacity: 0.4 }),
      rect(10, -48, 36, 96, { rx: 8, fill: "url(#gm)", ...O(c) }),
      rect(46, -42, 78, 84, { rx: 12, fill: "url(#gr)", ...O(c) }),
      circle(78, -14, 7, { fill: P.metalLo }),
      circle(104, -14, 7, { fill: P.metalLo }),
      circle(78, 14, 7, { fill: P.metalLo }),
      circle(104, 14, 7, { fill: P.metalLo }),
      path("M 124 0 C 160 0 160 70 120 90 C 80 108 20 96 -10 120", { fill: "none", stroke: P.stroke, "stroke-width": 9, "stroke-linecap": "round" }),
    ],
    { transform: "rotate(-8) translate(-6 -6)" },
  );
}

/* ------------------------------------------------------------------ engine */

export function plug(c: Ctx): string {
  const { P } = c;
  const ribs = [-128, -110, -92].map((y) => ellipse(0, y, 30, 7, { fill: "url(#gp)", ...O(c, 1.6) }));
  return g(
    [
      rect(-12, -190, 24, 26, { rx: 4, fill: "url(#gm)", ...O(c) }),
      rect(-26, -166, 52, 98, { rx: 14, fill: "url(#gp)", ...O(c) }),
      ...ribs,
      rect(-27, -60, 54, 12, { fill: "url(#ga)", ...O(c, 1.6) }),
      polygon([[-40, -44], [40, -44], [46, -22], [40, 0], [-40, 0], [-46, -22]], { fill: "url(#gh)", ...O(c) }),
      rect(-24, 0, 48, 92, { fill: "url(#gh)", ...O(c) }),
      ...Array.from({ length: 9 }, (_, i) => line(-24, 8 + i * 10, 24, 0 + i * 10 + 6, { stroke: P.metalLo, "stroke-width": 1.6 })),
      rect(-24, 92, 48, 14, { fill: "url(#gm)", ...O(c, 1.6) }),
      path("M 8 106 L 8 124 Q 8 138 -14 138 L -32 138", { fill: "none", stroke: "url(#gm)", "stroke-width": 8, "stroke-linecap": "round" }),
      rect(-3, 100, 6, 30, { fill: P.accent, stroke: P.stroke, "stroke-width": 1 }),
    ],
    { transform: `rotate(${pick(c, [-14, -10, 10, 14])} 0 0) scale(0.95)` },
  );
}

export function coil(c: Ctx): string {
  const { P } = c;
  return g(
    [
      rect(-46, -168, 92, 190, { rx: 18, fill: "url(#gr)", ...O(c) }),
      ...[-140, -110, -80].map((y) => rect(-46, y, 92, 6, { fill: P.stroke, opacity: 0.55 })),
      rect(-30, -190, 60, 28, { rx: 8, fill: "url(#gd)", ...O(c) }),
      rect(46, -120, 54, 62, { rx: 8, fill: "url(#gr)", ...O(c) }),
      circle(66, -100, 6, { fill: P.metalLo }),
      circle(84, -100, 6, { fill: P.metalLo }),
      circle(75, -78, 6, { fill: P.metalLo }),
      rect(-46, -20, 92, 12, { fill: "url(#ga)", ...O(c, 1.6) }),
      path("M -34 22 L -26 130 L 26 130 L 34 22 Z", { fill: "url(#gd)", ...O(c) }),
      ...Array.from({ length: 7 }, (_, i) => path(`M -32 ${40 + i * 14} Q 0 ${52 + i * 14} 32 ${40 + i * 14}`, { fill: "none", stroke: P.metal, "stroke-width": 4 })),
      rect(-12, 130, 24, 22, { fill: "url(#gm)", ...O(c, 1.6) }),
    ],
    { transform: "rotate(14) translate(-6 6)" },
  );
}

function beltLoop(c: Ctx, withGear: boolean): string {
  const { P } = c;
  const loop = "M -120 -92 H 120 A 92 92 0 0 1 120 92 H -120 A 92 92 0 0 1 -120 -92 Z";
  const teeth = withGear ? "5 5" : "2 9";
  return g([
    path(loop, { fill: "none", stroke: P.stroke, "stroke-width": 30, "stroke-linejoin": "round" }),
    path(loop, { fill: "none", stroke: "url(#gd)", "stroke-width": 24 }),
    path(loop, { fill: "none", stroke: P.steel, "stroke-width": 24, "stroke-dasharray": teeth, opacity: 0.7 }),
    ...[[-120, 0, 66], [120, 0, 50]].map(([x, y, r]) => g([circle(x!, y!, r!, { fill: "url(#gm)", ...O(c) }), circle(x!, y!, r! - 14, { fill: "none", stroke: P.metalLo, "stroke-width": 2 }), circle(x!, y!, 14, { fill: P.rubber, ...O(c, 1.8) })])),
    circle(0, -92, 26, { fill: "url(#ga)", ...O(c) }),
    circle(0, -92, 8, { fill: P.rubber }),
    circle(0, 92, 22, { fill: "url(#gm)", ...O(c) }),
    circle(0, 92, 7, { fill: P.rubber }),
  ]);
}

export function timingkit(c: Ctx): string {
  const { P } = c;
  return g([
    g(beltLoop(c, true), { transform: "translate(-6 -10) scale(0.88)" }),
    g(
      [circle(0, 0, 54, { fill: "url(#gm)", ...O(c) }), ...Array.from({ length: 6 }, (_, i) => path(`M 0 0 Q ${30 * Math.cos(i * 1.047)} ${30 * Math.sin(i * 1.047)} ${44 * Math.cos(i * 1.047 + 0.7)} ${44 * Math.sin(i * 1.047 + 0.7)}`, { fill: "none", stroke: P.accent, "stroke-width": 7, "stroke-linecap": "round" })), circle(0, 0, 10, { fill: P.rubber })],
      { transform: "translate(118 118)" },
    ),
  ]);
}

export function belt(c: Ctx): string {
  return g(beltLoop(c, false), { transform: "scale(0.95)" });
}

export function gasket(c: Ctx): string {
  const { P } = c;
  const cyls = [-111, -37, 37, 111];
  const holes = cyls.map((x) => `M ${x + 34} 0 A 34 34 0 1 0 ${x - 34} 0 A 34 34 0 1 0 ${x + 34} 0 Z`).join(" ");
  const outer = "M -168 -84 Q -168 -100 -152 -100 H 152 Q 168 -100 168 -84 V 84 Q 168 100 152 100 H -152 Q -168 100 -168 84 Z";
  const small = [-150, -74, 0, 74, 150].flatMap((x) => [[x, -78], [x, 78]]);
  return g([
    path(`${outer} ${holes}`, { fill: "url(#gm)", "fill-rule": "evenodd", ...O(c, 2.4) }),
    ...cyls.map((x) => circle(x, 0, 41, { fill: "none", stroke: P.accent, "stroke-width": 4 })),
    ...small.map(([x, y]) => circle(x!, y!, 9, { fill: P.rubber, ...O(c, 1.6) })),
    path("M -150 -52 H 150 M -150 52 H 150", { fill: "none", stroke: P.metalLo, "stroke-width": 2, "stroke-dasharray": "8 6" }),
    ellipse(-110, -36, 14, 7, { fill: P.rubber, opacity: 0.8 }),
    ellipse(110, 36, 14, 7, { fill: P.rubber, opacity: 0.8 }),
  ]);
}

export function mount(c: Ctx): string {
  const { P } = c;
  return g([
    rect(-130, 96, 260, 28, { rx: 8, fill: "url(#gm)", ...O(c) }),
    circle(-100, 110, 8, { fill: P.rubber }),
    circle(100, 110, 8, { fill: P.rubber }),
    path("M -90 96 L -60 -44 H 60 L 90 96 Z", { fill: "url(#gr)", ...O(c) }),
    rect(-82, 36, 164, 16, { fill: "url(#ga)", ...O(c, 1.6) }),
    ellipse(0, -44, 64, 14, { fill: "url(#gd)", ...O(c) }),
    rect(-68, -76, 136, 26, { rx: 6, fill: "url(#gm)", ...O(c) }),
    rect(-14, -170, 28, 96, { rx: 4, fill: "url(#gh)", ...O(c) }),
    ...Array.from({ length: 8 }, (_, i) => line(-14, -160 + i * 11, 14, -154 + i * 11, { stroke: P.metalLo, "stroke-width": 1.4 })),
    path("M -48 -20 Q 0 -4 48 -20", { fill: "none", stroke: P.metalLo, "stroke-width": 2, opacity: 0.6 }),
  ]);
}

export function maf(c: Ctx): string {
  const { P } = c;
  return g(
    [
      rect(-160, -44, 320, 88, { rx: 18, fill: "url(#gr)", ...O(c) }),
      rect(-176, -54, 34, 108, { rx: 10, fill: "url(#gm)", ...O(c) }),
      rect(142, -54, 34, 108, { rx: 10, fill: "url(#gm)", ...O(c) }),
      rect(-52, -112, 122, 72, { rx: 12, fill: "url(#gd)", ...O(c) }),
      rect(-34, -98, 50, 26, { rx: 4, fill: P.rubber, ...O(c, 1.4) }),
      path("M -28 -85 H 10", { stroke: P.accent, "stroke-width": 4, "stroke-linecap": "round" }),
      rect(70, -104, 52, 46, { rx: 8, fill: "url(#gr)", ...O(c) }),
      circle(86, -88, 5, { fill: P.metalLo }),
      circle(106, -88, 5, { fill: P.metalLo }),
      circle(96, -70, 5, { fill: P.metalLo }),
      rect(-120, -10, 70, 20, { rx: 4, fill: "url(#ga)", opacity: 0.95 }),
      path("M -110 0 H -60", { stroke: P.paper, "stroke-width": 2, opacity: 0.8, "stroke-dasharray": "4 4" }),
    ],
    { transform: "rotate(-6) translate(0 20)" },
  );
}

/* ------------------------------------------------------------------ suspension */

export function shock(c: Ctx, slim = false): string {
  const { P } = c;
  const w = slim ? 0.62 : 1;
  return g(
    [
      circle(0, 168, 26, { fill: "url(#gd)", ...O(c) }),
      circle(0, 168, 12, { fill: P.metal, ...O(c, 1.8) }),
      rect(-30 * w, 20, 60 * w, 138, { rx: 12, fill: "url(#gh)", ...O(c) }),
      rect(-31 * w, 66, 62 * w, 18, { fill: "url(#ga)", ...O(c, 1.6) }),
      rect(-24 * w, -92, 48 * w, 118, { rx: 8, fill: "url(#gr)", ...O(c) }),
      ...Array.from({ length: slim ? 0 : 8 }, (_, i) => line(-24, -80 + i * 14, 24, -80 + i * 14, { stroke: P.stroke, "stroke-width": 2, opacity: 0.5 })),
      rect(-8 * w, -182, 16 * w, 96, { rx: 3, fill: "url(#gh)", ...O(c, 1.8) }),
      circle(0, -192, 18, { fill: "url(#gd)", ...O(c) }),
      circle(0, -192, 7, { fill: P.metal }),
    ],
    { transform: "rotate(-16) scale(0.95)" },
  );
}

function springPath(c: Ctx, x: number, top: number, bottom: number, turns: number, rx: number, width: number, front: string, back: string): string {
  const step = (bottom - top) / turns;
  const parts: string[] = [];
  for (let i = 0; i < turns; i++) {
    const y = top + i * step;
    parts.push(path(`M ${x - rx} ${y} Q ${x} ${y - step * 0.55} ${x + rx} ${y + step * 0.5}`, { fill: "none", stroke: back, "stroke-width": width, "stroke-linecap": "round" }));
  }
  for (let i = 0; i < turns; i++) {
    const y = top + i * step;
    parts.push(path(`M ${x + rx} ${y + step * 0.5} Q ${x} ${y + step * 1.15} ${x - rx} ${y + step}`, { fill: "none", stroke: front, "stroke-width": width, "stroke-linecap": "round" }));
  }
  void c;
  return g(parts);
}

export function spring(c: Ctx): string {
  const { P } = c;
  return g(springPath(c, 0, -150, 150, 8, 92, 17, P.accent, P.accentLo), { transform: "rotate(10)" });
}

export function strut(c: Ctx): string {
  const { P } = c;
  return g(
    [
      rect(-34, 26, 68, 150, { rx: 12, fill: "url(#gh)", ...O(c) }),
      rect(-38, 150, 76, 40, { rx: 8, fill: "url(#gm)", ...O(c) }),
      circle(0, 172, 11, { fill: P.rubber }),
      rect(-18, -118, 36, 160, { rx: 6, fill: "url(#gr)", ...O(c) }),
      springPath(c, 0, -102, 62, 6, 76, 13, P.accent, P.accentLo),
      rect(-70, 54, 140, 12, { rx: 5, fill: "url(#gm)", ...O(c, 1.8) }),
      rect(-66, -150, 132, 22, { rx: 7, fill: "url(#gm)", ...O(c) }),
      rect(-30, -178, 60, 30, { rx: 8, fill: "url(#gd)", ...O(c) }),
      rect(-6, -196, 12, 20, { rx: 2, fill: "url(#gh)", ...O(c, 1.4) }),
    ],
    { transform: "rotate(-8) scale(0.9)" },
  );
}

export function arm(c: Ctx): string {
  const { P } = c;
  return g(
    [
      path("M -150 78 L -40 -104 Q 0 -128 40 -104 L 150 78 Q 156 112 120 112 H -120 Q -156 112 -150 78 Z", { fill: "none", stroke: P.stroke, "stroke-width": 2.4 }),
      path("M -128 74 L -30 -90 Q 0 -108 30 -90 L 128 74 L 100 92 L 0 -48 L -100 92 Z", { fill: "url(#gd)", ...O(c, 2.6) }),
      path("M -100 92 L 100 92", { stroke: P.metalLo, "stroke-width": 8, "stroke-linecap": "round" }),
      path("M -112 70 L -26 -76 M 112 70 L 26 -76", { fill: "none", stroke: P.metalHi, "stroke-width": 3, opacity: 0.45 }),
      ...[[-128, 92], [128, 92]].map(([x, y]) => g([circle(x!, y!, 36, { fill: "url(#gr)", ...O(c) }), circle(x!, y!, 22, { fill: "url(#gm)", ...O(c, 1.8) }), circle(x!, y!, 10, { fill: P.rubber })])),
      circle(0, -86, 30, { fill: "url(#gm)", ...O(c) }),
      circle(0, -86, 14, { fill: "url(#ga)", ...O(c, 1.8) }),
      rect(-6, -140, 12, 34, { rx: 2, fill: "url(#gh)", ...O(c, 1.4) }),
    ],
    { transform: "translate(0 14)" },
  );
}

export function link(c: Ctx): string {
  const { P } = c;
  const end = (x: number) =>
    g([
      circle(x, 0, 30, { fill: "url(#gd)", ...O(c) }),
      path(`M ${x - 18} -14 Q ${x} -34 ${x + 18} -14`, { fill: "none", stroke: P.metalHi, "stroke-width": 3, opacity: 0.5 }),
      circle(x, 0, 14, { fill: "url(#gm)", ...O(c, 1.8) }),
      rect(x - 7, -62, 14, 34, { rx: 2, fill: "url(#gh)", ...O(c, 1.4) }),
      hexagon(x, -62, 12, { fill: "url(#gm)", ...O(c, 1.4) }),
    ]);
  return g([rect(-150, -9, 300, 18, { rx: 9, fill: "url(#gh)", ...O(c) }), end(-150), end(150), rect(-30, -13, 60, 26, { rx: 6, fill: "url(#ga)", ...O(c, 1.6) })], { transform: "rotate(-22) translate(0 8)" });
}

export function balljoint(c: Ctx): string {
  const { P } = c;
  return g([
    rect(-12, -190, 24, 90, { rx: 3, fill: "url(#gh)", ...O(c) }),
    ...Array.from({ length: 7 }, (_, i) => line(-12, -184 + i * 11, 12, -178 + i * 11, { stroke: P.metalLo, "stroke-width": 1.4 })),
    circle(0, -108, 22, { fill: "url(#gm)", ...O(c, 1.8) }),
    path("M -26 -90 Q -62 -10 -64 28 L 64 28 Q 62 -10 26 -90 Z", { fill: "url(#gr)", ...O(c) }),
    ...[-52, -22, 6].map((y) => path(`M ${-26 - (y + 90) * 0.2} ${y} Q 0 ${y + 14} ${26 + (y + 90) * 0.2} ${y}`, { fill: "none", stroke: P.stroke, "stroke-width": 2.4, opacity: 0.7 })),
    rect(-92, 28, 184, 44, { rx: 12, fill: "url(#gh)", ...O(c) }),
    rect(-92, 44, 184, 8, { fill: "url(#ga)" }),
    circle(-70, 50, 8, { fill: P.rubber }),
    circle(70, 50, 8, { fill: P.rubber }),
    rect(-14, 72, 28, 48, { rx: 8, fill: "url(#gm)", ...O(c) }),
    circle(0, 128, 7, { fill: "url(#ga)", ...O(c, 1.4) }),
  ]);
}

export function bearing(c: Ctx): string {
  const { P } = c;
  return g([
    circle(0, 0, 170, { fill: "url(#gdisc)", ...O(c, 2.6) }),
    ...ring(0, 0, 124, 5).map(([x, y]) => g([circle(x, y, 20, { fill: P.rubber, ...O(c, 1.8) }), circle(x - 3, y - 3, 5, { fill: P.metalHi, opacity: 0.45 })])),
    circle(0, 0, 84, { fill: "url(#gm)", ...O(c) }),
    circle(0, 0, 70, { fill: "none", stroke: P.accent, "stroke-width": 5 }),
    circle(0, 0, 50, { fill: P.rubber, ...O(c) }),
    circle(0, 0, 38, { fill: "url(#gm)", ...O(c, 1.8) }),
    ...Array.from({ length: 24 }, (_, i) => {
      const a = (i * Math.PI * 2) / 24;
      return line(Math.cos(a) * 30, Math.sin(a) * 30, Math.cos(a) * 38, Math.sin(a) * 38, { stroke: P.stroke, "stroke-width": 2.4 });
    }),
    circle(0, 0, 24, { fill: P.rubber }),
    circle(0, 0, 166, { fill: "none", stroke: P.metalHi, "stroke-width": 2, opacity: 0.6 }),
  ]);
}

export function bushing(c: Ctx): string {
  const { P } = c;
  const one = (x: number, y: number, r: number) =>
    g([
      circle(x, y, r, { fill: "url(#gr)", ...O(c) }),
      circle(x, y, r * 0.72, { fill: "none", stroke: P.accent, "stroke-width": 4 }),
      circle(x, y, r * 0.48, { fill: "url(#gm)", ...O(c, 1.8) }),
      circle(x, y, r * 0.26, { fill: P.rubber, ...O(c, 1.4) }),
      path(`M ${x - r * 0.6} ${y - r * 0.5} A ${r * 0.8} ${r * 0.8} 0 0 1 ${x + r * 0.1} ${y - r * 0.78}`, { fill: "none", stroke: P.metalHi, "stroke-width": 3, opacity: 0.35 }),
    ]);
  return g([one(-72, -50, 84), one(86, -28, 66), one(-14, 104, 56)]);
}

/* ------------------------------------------------------------------ filters */

export function oilfilter(c: Ctx, cartridge = false): string {
  const { P } = c;
  if (cartridge) {
    return g(
      [
        ellipse(0, 112, 76, 20, { fill: "url(#gd)", ...O(c) }),
        rect(-76, -96, 152, 208, { fill: P.paper, ...O(c) }),
        ...Array.from({ length: 16 }, (_, i) => line(-72 + i * 9.6, -96, -72 + i * 9.6, 112, { stroke: P.metalLo, "stroke-width": 1.8, opacity: 0.7 })),
        rect(-76, -96, 152, 208, { fill: "url(#gh)", opacity: 0.25 }),
        ellipse(0, -96, 76, 20, { fill: "url(#gd)", ...O(c) }),
        ellipse(0, -96, 28, 8, { fill: P.rubber }),
        rect(-80, -66, 160, 16, { fill: "url(#ga)", ...O(c, 1.6) }),
        ellipse(110, 150, 40, 14, { fill: "none", stroke: P.rubber, "stroke-width": 9, transform: "rotate(-12 110 150)" }),
      ],
      { transform: "translate(-12 -6) scale(0.92)" },
    );
  }
  return g(
    [
      rect(-62, 112, 124, 30, { rx: 6, fill: "url(#gm)", ...O(c) }),
      ellipse(0, 142, 62, 12, { fill: "url(#gd)", ...O(c, 1.8) }),
      ellipse(0, 142, 26, 6, { fill: P.rubber }),
      path("M -70 -80 Q -70 -118 0 -122 Q 70 -118 70 -80 V 112 H -70 Z", { fill: "url(#gah)", ...O(c, 2.4) }),
      rect(-70, -60, 140, 12, { fill: "url(#gm)", ...O(c, 1.6), opacity: 0.95 }),
      ...[-40, -26, 80, 94].map((y) => line(-70, y, 70, y, { stroke: P.stroke, "stroke-width": 1.4, opacity: 0.35 })),
      rect(-52, -20, 104, 74, { rx: 6, fill: P.paper, ...O(c, 1.4) }),
      rect(-52, -20, 104, 22, { rx: 6, fill: P.rubber }),
      line(-40, 18, 40, 18, { stroke: P.stroke, "stroke-width": 3, opacity: 0.6 }),
      line(-40, 32, 12, 32, { stroke: P.stroke, "stroke-width": 3, opacity: 0.4 }),
      path("M -50 -70 Q -52 -100 -30 -108", { fill: "none", stroke: P.metalHi, "stroke-width": 5, opacity: 0.45, "stroke-linecap": "round" }),
    ],
    { transform: "translate(0 -10)" },
  );
}

export function airfilter(c: Ctx, variant: "panel" | "cabin" | "perf" = "panel"): string {
  const { P } = c;
  if (variant === "perf") {
    return g([
      ellipse(0, 130, 120, 26, { fill: "url(#gd)", ...O(c) }),
      path("M -120 130 L -78 -88 H 78 L 120 130 Z", { fill: "url(#ga)", ...O(c, 2.4) }),
      ...Array.from({ length: 14 }, (_, i) => line(-114 + i * 17.5, 128, -74 + i * 11.4, -86, { stroke: P.stroke, "stroke-width": 1.6, opacity: 0.4 })),
      ...Array.from({ length: 6 }, (_, i) => path(`M ${-116 + i * 5} ${112 - i * 40} Q 0 ${126 - i * 40} ${116 - i * 5} ${112 - i * 40}`, { fill: "none", stroke: P.stroke, "stroke-width": 1.4, opacity: 0.35 })),
      ellipse(0, -88, 78, 18, { fill: "url(#gm)", ...O(c) }),
      ellipse(0, -88, 46, 9, { fill: P.rubber }),
      rect(-14, -126, 28, 40, { rx: 4, fill: "url(#gm)", ...O(c, 1.6) }),
    ]);
  }
  const cabin = variant === "cabin";
  const pleats = cabin ? 22 : 15;
  const gradient = cabin ? "url(#gd)" : "url(#gp)";
  return g(
    [
      polygon([[-166, -92], [124, -118], [170, 74], [-120, 100]], { fill: P.rubber, ...O(c) }),
      polygon([[-148, -76], [118, -100], [152, 60], [-110, 84]], { fill: gradient, ...O(c, 1.6) }),
      ...Array.from({ length: pleats }, (_, i) => {
        const t = (i + 1) / (pleats + 1);
        const x1 = -148 + (118 + 148) * t;
        const y1 = -76 + (-100 + 76) * t;
        const x2 = -110 + (152 + 110) * t;
        const y2 = 84 + (60 - 84) * t;
        return line(x1, y1, x2, y2, { stroke: cabin ? P.metalLo : P.metalLo, "stroke-width": 1.8, opacity: cabin ? 0.7 : 0.8 });
      }),
      cabin
        ? ""
        : polygon([[-166, -92], [124, -118], [128, -102], [-162, -76]], { fill: P.accent, opacity: 0.9 }),
      cabin ? path("M -60 0 L 20 -12 L 8 -30 M 20 -12 L 8 6", { fill: "none", stroke: P.accent, "stroke-width": 7, "stroke-linecap": "round", "stroke-linejoin": "round", transform: "translate(10 10)" }) : "",
      cabin ? polygon([[100, -118], [124, -118], [170, 74], [146, 76]], { fill: P.accent, opacity: 0.9 }) : "",
    ],
    { transform: "translate(0 8)" },
  );
}

export function fuelfilter(c: Ctx): string {
  const { P } = c;
  return g(
    [
      rect(-84, -48, 168, 96, { rx: 22, fill: "url(#gh)", ...O(c) }),
      rect(-84, -48, 168, 96, { rx: 22, fill: "url(#gah)", opacity: 0.28 }),
      rect(-30, -50, 60, 100, { fill: P.paper, opacity: 0.92, ...O(c, 1.4) }),
      path("M -18 0 H 14 M 4 -10 L 16 0 L 4 10", { fill: "none", stroke: P.accent, "stroke-width": 5, "stroke-linecap": "round", "stroke-linejoin": "round" }),
      ...[-62, -52, 52, 62].map((x) => line(x, -48, x, 48, { stroke: P.stroke, "stroke-width": 1.6, opacity: 0.35 })),
      rect(-124, -20, 42, 40, { rx: 6, fill: "url(#gm)", ...O(c) }),
      rect(82, -20, 42, 40, { rx: 6, fill: "url(#gm)", ...O(c) }),
      ...[-142, -128, 128, 142].map((x) => path(`M ${x} -14 L ${x + (x < 0 ? -10 : 10)} -22 V 22 L ${x} 14 Z`, { fill: "url(#gm)", ...O(c, 1.4) })),
      rect(-50, 44, 100, 20, { rx: 6, fill: "url(#gr)", ...O(c, 1.6) }),
    ],
    { transform: "rotate(-10)" },
  );
}

export function pan(c: Ctx): string {
  const { P } = c;
  return g(
    [
      path("M -168 -70 Q -168 -92 -146 -92 H 146 Q 168 -92 168 -70 V 66 Q 168 92 140 92 H -140 Q -168 92 -168 66 Z", { fill: "url(#gr)", ...O(c, 2.4) }),
      rect(-140, -64, 280, 128, { rx: 14, fill: "url(#gm)", ...O(c) }),
      ...Array.from({ length: 12 }, (_, i) => line(-130 + i * 23.6, -62, -130 + i * 23.6, 62, { stroke: P.metalLo, "stroke-width": 1.4, opacity: 0.55 })),
      ...Array.from({ length: 6 }, (_, i) => line(-138, -50 + i * 22, 138, -50 + i * 22, { stroke: P.metalLo, "stroke-width": 1.4, opacity: 0.55 })),
      rect(-140, -64, 280, 128, { rx: 14, fill: "none", stroke: P.accent, "stroke-width": 4 }),
      ...[[-158, -82], [158, -82], [-158, 82], [158, 82]].map(([x, y]) => circle(x!, y!, 8, { fill: P.rubber, ...O(c, 1.6) })),
      rect(112, -24, 66, 48, { rx: 8, fill: "url(#gh)", ...O(c) }),
      circle(150, 0, 12, { fill: P.rubber }),
    ],
    { transform: "rotate(-6)" },
  );
}
