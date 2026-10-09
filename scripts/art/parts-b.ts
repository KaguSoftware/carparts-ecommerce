/**
 * Part illustrations, group B: lighting, electrical, exhaust, cooling, body, fluids.
 */
import type { Ctx } from "./parts-a";
import { circle, ellipse, g, hexagon, line, outline, path, polygon, rect, ring, text, type Attrs } from "./svg";

const O = (c: Ctx, w = 2.2): Attrs => outline(c.P, w);

/* ------------------------------------------------------------------ lighting */

export function bulb(c: Ctx, kind: "h7" | "hid" | "small" = "h7"): string {
  const { P } = c;
  if (kind === "small") {
    const one = (x: number, y: number, rot: number, s: number) =>
      g(
        [
          path("M -16 -24 Q -16 -64 0 -66 Q 16 -64 16 -24 V 10 H -16 Z", { fill: "url(#gg)", ...O(c, 2) }),
          path("M -6 -20 L -4 -40 L 0 -22 L 4 -40 L 6 -20", { fill: "none", stroke: P.accent, "stroke-width": 2.4, "stroke-linejoin": "round" }),
          rect(-14, 10, 28, 34, { rx: 3, fill: "url(#gh)", ...O(c, 2) }),
          rect(-8, 44, 16, 22, { rx: 2, fill: "url(#gm)", ...O(c, 1.6) }),
        ],
        { transform: `translate(${x} ${y}) rotate(${rot}) scale(${s})` },
      );
    return g([ellipse(0, 10, 120, 100, { fill: "url(#gglow)", opacity: 0.55 }), one(-90, 20, -14, 1.5), one(0, -10, 0, 1.8), one(92, 24, 14, 1.4)]);
  }
  const hid = kind === "hid";
  return g(
    [
      ellipse(0, -40, 110, 130, { fill: hid ? "none" : "url(#gglow)", opacity: 0.6 }),
      path("M -34 -20 Q -34 -150 0 -170 Q 34 -150 34 -20 V 30 H -34 Z", { fill: "url(#gg)", ...O(c, 2.2) }),
      path("M -18 -140 Q -18 -90 -22 -30", { fill: "none", stroke: P.paper, "stroke-width": 4, opacity: 0.55, "stroke-linecap": "round" }),
      hid
        ? g([line(0, -120, 0, -20, { stroke: P.metalHi, "stroke-width": 4 }), rect(-6, -92, 12, 30, { rx: 6, fill: "#7fb8ff", opacity: 0.85 }), line(-14, -60, 14, -60, { stroke: P.metalLo, "stroke-width": 2 })])
        : g([path("M -14 -50 L -10 -100 L -3 -60 L 3 -100 L 10 -60 L 14 -100", { fill: "none", stroke: P.accent, "stroke-width": 3.4, "stroke-linejoin": "round" }), line(-14, -50, -14, 30, { stroke: P.metalLo, "stroke-width": 2.4 }), line(14, -50, 14, 30, { stroke: P.metalLo, "stroke-width": 2.4 })]),
      rect(-42, 30, 84, 48, { rx: 6, fill: "url(#gh)", ...O(c) }),
      rect(-42, 56, 84, 8, { fill: "url(#ga)" }),
      rect(-30, 78, 60, 56, { rx: 8, fill: "url(#gd)", ...O(c) }),
      rect(-24, 100, 48, 10, { fill: P.rubber }),
      ...[-16, 0, 16].map((x) => rect(x - 4, 134, 8, 26, { rx: 2, fill: "url(#gm)", ...O(c, 1.4) })),
    ],
    { transform: hid ? "rotate(8)" : "rotate(-8)" },
  );
}

export function led(c: Ctx): string {
  const { P } = c;
  return g(
    [
      circle(0, -92, 82, { fill: "url(#gglow)", opacity: 0.45 }),
      rect(-66, -130, 132, 76, { rx: 20, fill: "url(#gd)", ...O(c) }),
      rect(-50, -114, 100, 44, { rx: 10, fill: P.paper, opacity: 0.95 }),
      ...[-30, -10, 10, 30].map((x) => rect(x - 7, -106, 14, 28, { rx: 3, fill: P.glow, stroke: P.stroke, "stroke-width": 1 })),
      rect(-56, -54, 112, 14, { fill: "url(#ga)", ...O(c, 1.6) }),
      ...Array.from({ length: 10 }, (_, i) => rect(-56 + i * 11.4, -40, 7, 92, { rx: 2, fill: "url(#gh)", ...O(c, 1.4) })),
      rect(-56, 50, 112, 10, { rx: 4, fill: "url(#gm)", ...O(c, 1.6) }),
      circle(0, 108, 52, { fill: "url(#gr)", ...O(c) }),
      circle(0, 108, 44, { fill: "none", stroke: P.metalLo, "stroke-width": 1.6 }),
      ...Array.from({ length: 7 }, (_, i) => {
        const a = (i * Math.PI * 2) / 7;
        return path(`M 0 108 Q ${Math.cos(a) * 36} ${108 + Math.sin(a) * 36} ${Math.cos(a + 0.8) * 42} ${108 + Math.sin(a + 0.8) * 42}`, { fill: "none", stroke: P.metal, "stroke-width": 7, "stroke-linecap": "round" });
      }),
      circle(0, 108, 8, { fill: "url(#ga)" }),
      path("M 52 112 C 104 112 110 150 150 150", { fill: "none", stroke: P.stroke, "stroke-width": 8, "stroke-linecap": "round" }),
    ],
    { transform: "translate(0 10) scale(0.95)" },
  );
}

export function headlight(c: Ctx): string {
  const { P } = c;
  return g([
    path("M -190 -26 C -140 -92 40 -124 190 -72 L 182 30 C 100 84 -80 100 -186 62 Z", { fill: "url(#gd)", ...O(c, 2.6) }),
    path("M -178 -20 C -132 -78 40 -108 176 -62 L 170 22 C 94 70 -78 86 -174 52 Z", { fill: "none", stroke: P.metal, "stroke-width": 3, opacity: 0.6 }),
    circle(-84, -2, 58, { fill: "url(#gm)", ...O(c) }),
    circle(-84, -2, 46, { fill: "url(#gd)", ...O(c, 1.8) }),
    circle(-84, -2, 36, { fill: "url(#gg)", ...O(c, 1.6) }),
    circle(-84, -2, 16, { fill: "url(#gglow)" }),
    path("M -108 -22 A 36 36 0 0 1 -72 -36", { fill: "none", stroke: P.paper, "stroke-width": 4, "stroke-linecap": "round", opacity: 0.7 }),
    circle(34, -14, 42, { fill: "url(#gm)", ...O(c) }),
    circle(34, -14, 32, { fill: "url(#gd)", ...O(c, 1.8) }),
    circle(34, -14, 22, { fill: "url(#gg)", ...O(c, 1.6) }),
    circle(34, -14, 9, { fill: "url(#gglow)" }),
    path("M -170 -34 C -120 -86 30 -108 170 -66", { fill: "none", stroke: P.accent, "stroke-width": 7, "stroke-linecap": "round" }),
    path("M 80 36 C 118 40 150 30 170 12", { fill: "none", stroke: P.glow, "stroke-width": 8, "stroke-linecap": "round", opacity: 0.9 }),
    path("M -170 50 C -120 64 -60 66 -20 54", { fill: "none", stroke: P.metalLo, "stroke-width": 3, opacity: 0.7 }),
    circle(-176, 36, 5, { fill: P.rubber }),
    circle(170, -56, 5, { fill: P.rubber }),
  ]);
}

export function taillight(c: Ctx): string {
  const { P } = c;
  const red = "#c8323c";
  return g(
    [
      path("M -186 -50 Q -186 -80 -150 -76 L 150 -48 Q 186 -44 184 -10 L 176 54 Q 172 84 140 80 L -150 62 Q -184 60 -184 30 Z", { fill: "url(#gd)", ...O(c, 2.6) }),
      path("M -168 -44 L 146 -30 Q 168 -28 166 -8 L 160 44 Q 158 62 138 60 L -146 48 Q -166 46 -166 24 Z", { fill: red, ...O(c, 1.8) }),
      path("M -168 -44 L 146 -30 Q 168 -28 166 -8 L 160 6 Q 0 -4 -166 -2 Z", { fill: "#e5545c", opacity: 0.55 }),
      ...Array.from({ length: 9 }, (_, i) => rect(-150 + i * 34, -22 + i * 1.8, 20, 6, { rx: 3, fill: P.paper, opacity: 0.85 })),
      ...Array.from({ length: 9 }, (_, i) => rect(-150 + i * 34, 4 + i * 1.8, 20, 6, { rx: 3, fill: P.paper, opacity: 0.55 })),
      path("M 60 52 L 140 56", { stroke: P.glow, "stroke-width": 12, "stroke-linecap": "round" }),
      path("M -150 54 L -70 52", { stroke: P.paper, "stroke-width": 12, "stroke-linecap": "round", opacity: 0.9 }),
      path("M -170 -62 C -110 -68 40 -50 150 -36", { fill: "none", stroke: P.accent, "stroke-width": 4, "stroke-linecap": "round" }),
    ],
    { transform: "rotate(-4)" },
  );
}

export function foglight(c: Ctx): string {
  const { P } = c;
  return g([
    rect(-30, 90, 60, 70, { rx: 8, fill: "url(#gh)", ...O(c) }),
    circle(0, 0, 124, { fill: "url(#gd)", ...O(c, 2.6) }),
    circle(0, 0, 112, { fill: "url(#gm)", ...O(c) }),
    circle(0, 0, 98, { fill: "url(#gd)", ...O(c, 1.8) }),
    circle(0, 0, 90, { fill: "url(#gg)", ...O(c, 1.6) }),
    ...[24, 44, 64, 82].map((r) => circle(0, 0, r, { fill: "none", stroke: P.paper, "stroke-width": 1.4, opacity: 0.35 })),
    ...Array.from({ length: 16 }, (_, i) => {
      const a = (i * Math.PI * 2) / 16;
      return line(Math.cos(a) * 24, Math.sin(a) * 24, Math.cos(a) * 88, Math.sin(a) * 88, { stroke: P.paper, "stroke-width": 1, opacity: 0.22 });
    }),
    circle(0, 0, 30, { fill: "url(#gglow)" }),
    circle(0, 0, 9, { fill: P.paper, opacity: 0.9 }),
    path("M -70 -50 A 86 86 0 0 1 -20 -86", { fill: "none", stroke: P.paper, "stroke-width": 6, "stroke-linecap": "round", opacity: 0.6 }),
    circle(0, 0, 106, { fill: "none", stroke: P.accent, "stroke-width": 4 }),
  ]);
}

export function interior(c: Ctx): string {
  const { P } = c;
  const festoon = (y: number, rot: number) =>
    g(
      [
        rect(-120, -12, 22, 24, { rx: 4, fill: "url(#gm)", ...O(c, 1.6) }),
        rect(98, -12, 22, 24, { rx: 4, fill: "url(#gm)", ...O(c, 1.6) }),
        rect(-98, -16, 196, 32, { rx: 14, fill: "url(#gg)", ...O(c, 1.8) }),
        ...[-60, -20, 20, 60].map((x) => rect(x - 11, -8, 22, 16, { rx: 3, fill: P.glow, stroke: P.stroke, "stroke-width": 1 })),
        rect(-98, -16, 196, 10, { rx: 5, fill: P.paper, opacity: 0.35 }),
      ],
      { transform: `translate(0 ${y}) rotate(${rot})` },
    );
  const wedge = (x: number, y: number) =>
    g([path("M -14 -20 Q -14 -44 0 -44 Q 14 -44 14 -20 V 8 H -14 Z", { fill: "url(#gg)", ...O(c, 1.8) }), rect(-10, -34, 20, 12, { rx: 3, fill: P.glow }), rect(-12, 8, 24, 24, { rx: 3, fill: "url(#gd)", ...O(c, 1.6) }), rect(-8, 32, 6, 22, { fill: "url(#gm)" }), rect(2, 32, 6, 22, { fill: "url(#gm)" })], { transform: `translate(${x} ${y})` });
  return g([ellipse(0, 20, 170, 110, { fill: "url(#gglow)", opacity: 0.3 }), festoon(-86, -8), festoon(-30, -4), wedge(-90, 90), wedge(-30, 100), wedge(40, 96), wedge(100, 88)]);
}

/* ------------------------------------------------------------------ electrical */

export function battery(c: Ctx): string {
  const { P } = c;
  return g(
    [
      polygon([[-150, -60], [-110, -104], [170, -104], [150, -60]], { fill: "url(#gm)", ...O(c) }),
      polygon([[150, -60], [170, -104], [170, 62], [150, 110]], { fill: "url(#gd)", ...O(c) }),
      rect(-150, -60, 300, 170, { rx: 6, fill: "url(#gr)", ...O(c, 2.4) }),
      rect(-134, -34, 268, 110, { rx: 6, fill: P.paper, ...O(c, 1.4) }),
      rect(-134, -34, 268, 34, { rx: 6, fill: "url(#ga)" }),
      rect(-134, -10, 268, 10, { fill: "url(#ga)" }),
      line(-112, 22, 20, 22, { stroke: P.stroke, "stroke-width": 7, "stroke-linecap": "round", opacity: 0.8 }),
      line(-112, 44, -30, 44, { stroke: P.stroke, "stroke-width": 5, "stroke-linecap": "round", opacity: 0.5 }),
      ...[0, 1, 2, 3, 4].map((i) => rect(40 + i * 17, 26 - i * 3, 11, 30 + i * 6, { fill: P.accent, stroke: P.stroke, "stroke-width": 1 })),
      rect(-138, 82, 50, 18, { rx: 4, fill: "url(#gm)", ...O(c, 1.6) }),
      rect(88, 82, 50, 18, { rx: 4, fill: "url(#gm)", ...O(c, 1.6) }),
      ...[[-100, -88, "#c8323c"], [110, -88, P.stroke]].map(([x, y, col]) => g([ellipse(x as number, (y as number) + 4, 26, 10, { fill: "url(#gd)", ...O(c, 1.6) }), rect((x as number) - 18, (y as number) - 22, 36, 28, { rx: 4, fill: "url(#gm)", ...O(c) }), rect((x as number) - 10, (y as number) - 32, 20, 14, { rx: 3, fill: "url(#gh)", ...O(c, 1.6) }), circle(x as number, (y as number) - 8, 4, { fill: col as string })])),
    ],
    { transform: "translate(0 16) scale(0.96)" },
  );
}

export function alternator(c: Ctx): string {
  const { P } = c;
  const slots = Array.from({ length: 14 }, (_, i) => {
    const a = (i * Math.PI * 2) / 14;
    return rect(-5, -118, 10, 26, { rx: 4, fill: P.rubber, transform: `rotate(${(a * 180) / Math.PI})`, opacity: 0.85 });
  });
  return g([
    circle(-130, -30, 34, { fill: "url(#gm)", ...O(c) }),
    circle(-130, -30, 14, { fill: P.rubber }),
    circle(130, 70, 34, { fill: "url(#gm)", ...O(c) }),
    circle(130, 70, 14, { fill: P.rubber }),
    circle(0, 0, 138, { fill: "url(#gdisc)", ...O(c, 2.6) }),
    circle(0, 0, 126, { fill: "none", stroke: P.metalLo, "stroke-width": 2 }),
    ...slots,
    circle(0, 0, 80, { fill: "url(#gm)", ...O(c) }),
    circle(0, 0, 80, { fill: "none", stroke: P.accent, "stroke-width": 5, opacity: 0.95 }),
    ...[56, 48, 40, 32].map((r) => circle(0, 0, r, { fill: "none", stroke: P.metalLo, "stroke-width": 1.8, opacity: 0.8 })),
    hexagon(0, 0, 20, { fill: "url(#gh)", ...O(c, 1.8) }),
    circle(0, 0, 7, { fill: P.rubber }),
    rect(90, -110, 38, 30, { rx: 6, fill: "url(#gr)", ...O(c) }),
    circle(100, -95, 5, { fill: P.metalLo }),
    circle(118, -95, 5, { fill: P.metalLo }),
  ]);
}

export function starter(c: Ctx): string {
  const { P } = c;
  return g(
    [
      rect(-100, -34, 190, 100, { rx: 22, fill: "url(#gh)", ...O(c) }),
      rect(-38, -34, 16, 100, { fill: "url(#ga)", ...O(c, 1.4) }),
      rect(-80, -88, 130, 56, { rx: 12, fill: "url(#gd)", ...O(c) }),
      rect(-80, -70, 130, 8, { fill: P.accent }),
      circle(-60, -100, 9, { fill: "url(#gm)", ...O(c, 1.6) }),
      circle(-20, -100, 9, { fill: "url(#gm)", ...O(c, 1.6) }),
      path("M 90 -22 L 126 -14 V 46 L 90 54 Z", { fill: "url(#gm)", ...O(c) }),
      rect(126, -2, 40, 28, { rx: 4, fill: "url(#gh)", ...O(c, 1.8) }),
      ...Array.from({ length: 6 }, (_, i) => rect(166, -4 + i * 5, 26, 3, { fill: "url(#gm)", stroke: P.stroke, "stroke-width": 0.8 })),
      path("M 166 -6 L 194 -2 L 194 30 L 166 28 Z", { fill: "url(#gm)", ...O(c, 1.6) }),
      rect(-128, -20, 28, 72, { rx: 10, fill: "url(#gm)", ...O(c) }),
      rect(-118, 66, 22, 34, { rx: 4, fill: "url(#gm)", ...O(c, 1.8) }),
      circle(-107, 90, 6, { fill: P.rubber }),
    ],
    { transform: "translate(-12 4) scale(0.95)" },
  );
}

export function charger(c: Ctx, jump = false): string {
  const { P } = c;
  const clamp = (x: number, y: number, col: string, rot: number) =>
    g([path("M -22 -12 L 22 -12 L 30 18 L -30 18 Z", { fill: col, ...O(c, 1.8) }), path("M -24 18 L -10 52 L 0 28 L 10 52 L 24 18", { fill: "url(#gm)", ...O(c, 1.8), "stroke-linejoin": "round" })], { transform: `translate(${x} ${y}) rotate(${rot})` });
  return g([
    path("M -70 52 C -110 100 -150 90 -148 130", { fill: "none", stroke: "#c8323c", "stroke-width": 8, "stroke-linecap": "round" }),
    path("M 70 52 C 110 100 150 90 148 130", { fill: "none", stroke: P.stroke, "stroke-width": 8, "stroke-linecap": "round" }),
    clamp(-148, 140, "#c8323c", 0),
    clamp(148, 140, P.stroke, 0),
    rect(-114, -108, 228, jump ? 170 : 160, { rx: jump ? 34 : 18, fill: "url(#gd)", ...O(c, 2.4) }),
    rect(-114, jump ? -68 : -108, 228, 16, { fill: "url(#ga)" }),
    rect(-88, -58, 176, 52, { rx: 8, fill: P.rubber, ...O(c, 1.6) }),
    ...[0, 1, 2, 3, 4, 5, 6].map((i) => rect(-76 + i * 24, -50, 16, 36, { rx: 3, fill: i < 5 ? P.accent : P.metalLo, opacity: i < 5 ? 1 : 0.45 })),
    circle(0, 26, 22, { fill: "url(#gm)", ...O(c) }),
    line(0, 26, 12, 14, { stroke: P.stroke, "stroke-width": 4, "stroke-linecap": "round" }),
    circle(-70, 30, 7, { fill: P.glow, stroke: P.stroke, "stroke-width": 1 }),
    circle(70, 30, 7, { fill: P.metalLo, stroke: P.stroke, "stroke-width": 1 }),
    jump ? circle(0, -82, 7, { fill: P.paper, opacity: 0.9 }) : "",
  ], { transform: "translate(0 -12) scale(0.9)" });
}

export function fuses(c: Ctx): string {
  const { P } = c;
  const colors = ["#b9a27c", "#c8323c", "#4f8cff", "#e8c23a", "#e9ecef", "#3fa56b"];
  const cells: string[] = [];
  for (let r = 0; r < 3; r++) {
    for (let col = 0; col < 4; col++) {
      const x = -108 + col * 72;
      const y = -76 + r * 66;
      const color = colors[(r * 4 + col) % colors.length]!;
      cells.push(
        g([rect(-22, -24, 44, 50, { rx: 6, fill: color, ...O(c, 1.6) }), rect(-12, -16, 24, 18, { rx: 3, fill: P.paper, opacity: 0.65 }), path("M -12 -8 H 12", { stroke: P.stroke, "stroke-width": 2, opacity: 0.7 }), rect(-14, 26, 8, 14, { fill: "url(#gm)", stroke: P.stroke, "stroke-width": 1 }), rect(6, 26, 8, 14, { fill: "url(#gm)", stroke: P.stroke, "stroke-width": 1 })], { transform: `translate(${x} ${y})` }),
      );
    }
  }
  return g([rect(-160, -130, 320, 250, { rx: 22, fill: "url(#gd)", ...O(c, 2.4) }), rect(-146, -116, 292, 222, { rx: 14, fill: P.rubber, opacity: 0.8 }), ...cells, rect(-160, 92, 320, 14, { fill: "url(#ga)" })], { transform: "translate(0 10)" });
}

export function relay(c: Ctx): string {
  const { P } = c;
  return g(
    [
      rect(-76, -86, 152, 170, { rx: 12, fill: "url(#gr)", ...O(c, 2.4) }),
      rect(-60, -70, 120, 82, { rx: 6, fill: P.paper, opacity: 0.95, ...O(c, 1.2) }),
      path("M -40 -34 H -14 M 14 -34 H 40 M -14 -34 L 12 -50", { fill: "none", stroke: P.stroke, "stroke-width": 4, "stroke-linecap": "round" }),
      rect(-40, -10, 80, 12, { fill: P.accent }),
      line(-44, -56, 44, -56, { stroke: P.stroke, "stroke-width": 2, opacity: 0.5 }),
      rect(-24, 84, 8, 54, { fill: "url(#gm)", stroke: P.stroke, "stroke-width": 1.6 }),
      rect(16, 84, 8, 54, { fill: "url(#gm)", stroke: P.stroke, "stroke-width": 1.6 }),
      rect(-64, 84, 8, 54, { fill: "url(#gm)", stroke: P.stroke, "stroke-width": 1.6 }),
      rect(56, 84, 8, 54, { fill: "url(#gm)", stroke: P.stroke, "stroke-width": 1.6 }),
      rect(-4, 84, 8, 40, { fill: "url(#gm)", stroke: P.stroke, "stroke-width": 1.6 }),
      rect(76, -26, 36, 38, { rx: 5, fill: "url(#gr)", ...O(c, 1.8) }),
      circle(94, -8, 7, { fill: P.rubber }),
    ],
    { transform: "translate(-6 -22) rotate(-6)" },
  );
}

/* ------------------------------------------------------------------ exhaust */

export function muffler(c: Ctx): string {
  const { P } = c;
  return g(
    [
      rect(-160, -9, 80, 18, { fill: "url(#gh)", ...O(c, 1.8) }),
      rect(150, -26, 70, 20, { rx: 4, fill: "url(#gh)", ...O(c, 1.8) }),
      rect(150, 8, 70, 20, { rx: 4, fill: "url(#gh)", ...O(c, 1.8) }),
      ellipse(210, -16, 8, 11, { fill: "url(#gd)", ...O(c, 1.4) }),
      ellipse(210, 18, 8, 11, { fill: "url(#gd)", ...O(c, 1.4) }),
      rect(-100, -66, 260, 132, { rx: 62, fill: "url(#gh)", ...O(c, 2.4) }),
      rect(-100, -66, 260, 132, { rx: 62, fill: "url(#gah)", opacity: 0.22 }),
      line(-30, -66, -30, 66, { stroke: P.stroke, "stroke-width": 3, opacity: 0.5 }),
      line(100, -64, 100, 64, { stroke: P.stroke, "stroke-width": 3, opacity: 0.5 }),
      rect(-100, -8, 260, 16, { fill: P.accent, opacity: 0.9 }),
      path("M -80 -50 Q 20 -66 120 -50", { fill: "none", stroke: P.metalHi, "stroke-width": 5, "stroke-linecap": "round", opacity: 0.7 }),
      line(-50, -66, -50, -96, { stroke: P.steel, "stroke-width": 8, "stroke-linecap": "round" }),
      line(110, -66, 110, -96, { stroke: P.steel, "stroke-width": 8, "stroke-linecap": "round" }),
      circle(-50, -100, 9, { fill: P.rubber, ...O(c, 1.6) }),
      circle(110, -100, 9, { fill: P.rubber, ...O(c, 1.6) }),
    ],
    { transform: "translate(-30 16) scale(0.9)" },
  );
}

export function cat(c: Ctx): string {
  const { P } = c;
  return g(
    [
      rect(-172, -14, 60, 28, { fill: "url(#gh)", ...O(c, 1.8) }),
      rect(112, -14, 60, 28, { fill: "url(#gh)", ...O(c, 1.8) }),
      rect(-190, -46, 22, 92, { rx: 5, fill: "url(#gm)", ...O(c) }),
      rect(168, -46, 22, 92, { rx: 5, fill: "url(#gm)", ...O(c) }),
      circle(-179, -30, 5, { fill: P.rubber }),
      circle(-179, 30, 5, { fill: P.rubber }),
      circle(179, -30, 5, { fill: P.rubber }),
      circle(179, 30, 5, { fill: P.rubber }),
      path("M -120 0 Q -120 -78 -30 -78 H 30 Q 120 -78 120 0 Q 120 78 30 78 H -30 Q -120 78 -120 0 Z", { fill: "url(#gh)", ...O(c, 2.6) }),
      ...Array.from({ length: 5 }, (_, r) => Array.from({ length: 11 }, (_, i) => circle(-80 + i * 16 + (r % 2) * 8, -42 + r * 21, 3.2, { fill: P.metalLo, opacity: 0.7 }))).flat(),
      rect(-120, -4, 240, 8, { fill: P.accent, opacity: 0.85 }),
      rect(-14, -108, 28, 34, { rx: 5, fill: "url(#gm)", ...O(c, 1.8) }),
      path("M 0 -108 C 0 -150 50 -150 56 -176", { fill: "none", stroke: P.stroke, "stroke-width": 6, "stroke-linecap": "round" }),
    ],
    { transform: "translate(0 20) scale(0.92)" },
  );
}

export function flexpipe(c: Ctx): string {
  const { P } = c;
  return g(
    [
      rect(-196, -26, 70, 52, { rx: 8, fill: "url(#gh)", ...O(c) }),
      rect(126, -26, 70, 52, { rx: 8, fill: "url(#gh)", ...O(c) }),
      rect(-132, -46, 264, 92, { rx: 20, fill: "url(#gr)", ...O(c, 2.4) }),
      rect(-126, -42, 252, 84, { rx: 16, fill: "url(#gh)", opacity: 0.95 }),
      ...Array.from({ length: 34 }, (_, i) => line(-120 + i * 7.4, -42, -100 + i * 7.4, 42, { stroke: P.metalLo, "stroke-width": 1.8, opacity: 0.8 })),
      ...Array.from({ length: 34 }, (_, i) => line(-100 + i * 7.4, -42, -120 + i * 7.4, 42, { stroke: P.metalLo, "stroke-width": 1.6, opacity: 0.55 })),
      rect(-142, -52, 20, 104, { rx: 5, fill: "url(#gm)", ...O(c) }),
      rect(122, -52, 20, 104, { rx: 5, fill: "url(#gm)", ...O(c) }),
      rect(-136, -4, 8, 8, { fill: P.accent }),
      rect(-132, -46, 264, 14, { rx: 6, fill: P.metalHi, opacity: 0.35 }),
    ],
    { transform: "rotate(-6) scale(0.95)" },
  );
}

export function pipe(c: Ctx): string {
  const { P } = c;
  const d = "M -180 70 C -110 70 -90 -40 -20 -40 S 90 60 180 40";
  return g([
    path(d, { fill: "none", stroke: P.stroke, "stroke-width": 44, "stroke-linecap": "round" }),
    path(d, { fill: "none", stroke: "url(#gm)", "stroke-width": 38, "stroke-linecap": "round" }),
    path(d, { fill: "none", stroke: P.metalHi, "stroke-width": 8, "stroke-linecap": "round", opacity: 0.55, transform: "translate(0 -10)" }),
    ellipse(-6, -34, 86, 62, { fill: "url(#gh)", ...O(c, 2.4), transform: "rotate(-12 -6 -34)" }),
    path("M -64 -26 Q -6 -52 54 -42", { fill: "none", stroke: P.accent, "stroke-width": 5, "stroke-linecap": "round" }),
    rect(-198, 36, 22, 66, { rx: 4, fill: "url(#gm)", ...O(c) }),
    rect(172, 8, 22, 66, { rx: 4, fill: "url(#gm)", ...O(c) }),
    circle(-187, 48, 4, { fill: P.rubber }),
    circle(-187, 90, 4, { fill: P.rubber }),
    circle(183, 20, 4, { fill: P.rubber }),
    circle(183, 62, 4, { fill: P.rubber }),
  ]);
}

export function lambda(c: Ctx): string {
  const { P } = c;
  return g(
    [
      path("M 0 -180 C 40 -180 40 -150 10 -140 C -20 -130 -20 -108 10 -104", { fill: "none", stroke: P.stroke, "stroke-width": 9, "stroke-linecap": "round" }),
      rect(-26, -104, 52, 20, { rx: 5, fill: "url(#gr)", ...O(c) }),
      rect(-20, -86, 40, 90, { rx: 6, fill: "url(#gh)", ...O(c) }),
      rect(-21, -50, 42, 12, { fill: "url(#ga)", ...O(c, 1.6) }),
      polygon(ring(0, 20, 40, 6, 0), { fill: "url(#gh)", ...O(c) }),
      rect(-24, 40, 48, 54, { fill: "url(#gh)", ...O(c) }),
      ...Array.from({ length: 5 }, (_, i) => line(-24, 46 + i * 10, 24, 40 + i * 10, { stroke: P.metalLo, "stroke-width": 1.6 })),
      path("M -22 94 H 22 V 150 Q 22 164 0 166 Q -22 164 -22 150 Z", { fill: "url(#gm)", ...O(c) }),
      ...Array.from({ length: 4 }, (_, i) => rect(-14, 104 + i * 12, 28, 4, { rx: 2, fill: P.rubber, opacity: 0.75 })),
    ],
    { transform: "rotate(-14) translate(0 8) scale(0.98)" },
  );
}

export function clamp(c: Ctx): string {
  const { P } = c;
  const band = (x: number, y: number, r: number, rot: number) =>
    g([circle(0, 0, r, { fill: "none", stroke: P.stroke, "stroke-width": 20 }), circle(0, 0, r, { fill: "none", stroke: "url(#gm)", "stroke-width": 15 }), rect(r - 12, -20, 36, 40, { rx: 4, fill: "url(#gh)", ...O(c, 1.8) }), circle(r + 18, 0, 6, { fill: "url(#ga)", ...O(c, 1.4) })], { transform: `translate(${x} ${y}) rotate(${rot})` });
  const gasket = g(
    [
      path("M -90 0 a 90 90 0 1 0 180 0 a 90 90 0 1 0 -180 0 Z M -52 0 a 52 52 0 1 1 104 0 a 52 52 0 1 1 -104 0 Z", { fill: P.paper, "fill-rule": "evenodd", ...O(c) }),
      ...ring(0, 0, 71, 4, Math.PI / 4).map(([x, y]) => circle(x, y, 9, { fill: P.bg, ...O(c, 1.6) })),
    ],
    { transform: "translate(70 70)" },
  );
  return g([band(-80, -70, 62, -20), band(70, -66, 48, 30), gasket, ...[0, 1, 2].map((i) => g([hexagon(0, 0, 14, { fill: "url(#gm)", ...O(c, 1.6) }), rect(-6, 10, 12, 44, { fill: "url(#gh)", ...O(c, 1.4) })], { transform: `translate(${-130 + i * 36} 110) rotate(${-10 + i * 6})` }))]);
}

/* ------------------------------------------------------------------ cooling */

export function radiator(c: Ctx): string {
  const { P } = c;
  return g(
    [
      rect(-178, -112, 356, 52, { rx: 10, fill: "url(#gr)", ...O(c, 2.4) }),
      rect(-178, 60, 356, 52, { rx: 10, fill: "url(#gr)", ...O(c, 2.4) }),
      rect(-166, -64, 332, 128, { fill: "url(#gm)", ...O(c, 2) }),
      ...Array.from({ length: 28 }, (_, i) => line(-158 + i * 11.7, -62, -158 + i * 11.7, 62, { stroke: P.metalLo, "stroke-width": 1.6, opacity: 0.75 })),
      ...Array.from({ length: 6 }, (_, i) => line(-164, -44 + i * 18, 164, -44 + i * 18, { stroke: P.stroke, "stroke-width": 1, opacity: 0.35 })),
      rect(-166, -6, 332, 12, { fill: P.accent, opacity: 0.9 }),
      rect(-210, -100, 34, 28, { rx: 6, fill: "url(#gd)", ...O(c, 1.8) }),
      rect(176, 68, 34, 28, { rx: 6, fill: "url(#gd)", ...O(c, 1.8) }),
      ellipse(110, -118, 22, 10, { fill: "url(#gm)", ...O(c, 1.8) }),
      rect(88, -146, 44, 30, { rx: 6, fill: "url(#gm)", ...O(c) }),
      circle(-150, -86, 7, { fill: P.rubber }),
      circle(150, 86, 7, { fill: P.rubber }),
    ],
    { transform: "translate(0 16) scale(0.95)" },
  );
}

export function pump(c: Ctx): string {
  const { P } = c;
  return g([
    path("M -120 -108 Q -150 -100 -150 -60 V 60 Q -150 100 -110 118 L 110 118 Q 150 100 150 60 V -60 Q 150 -100 120 -108 Z", { fill: "url(#gdisc)", ...O(c, 2.6) }),
    circle(0, 0, 112, { fill: "url(#gd)", ...O(c, 2.2) }),
    circle(0, 0, 100, { fill: P.rubber }),
    ...Array.from({ length: 9 }, (_, i) => {
      const a = (i * Math.PI * 2) / 9;
      return path(`M 0 0 Q ${Math.cos(a - 0.5) * 60} ${Math.sin(a - 0.5) * 60} ${Math.cos(a + 0.35) * 94} ${Math.sin(a + 0.35) * 94}`, { fill: "none", stroke: "url(#gm)", "stroke-width": 15, "stroke-linecap": "round" });
    }),
    circle(0, 0, 24, { fill: "url(#ga)", ...O(c) }),
    circle(0, 0, 9, { fill: P.rubber }),
    ...[[-128, -88], [128, -88], [-128, 90], [128, 90]].map(([x, y]) => circle(x!, y!, 12, { fill: P.rubber, ...O(c, 1.8) })),
    rect(-34, 112, 68, 40, { rx: 6, fill: "url(#gm)", ...O(c) }),
  ]);
}

export function thermostat(c: Ctx): string {
  const { P } = c;
  return g(
    [
      rect(-70, -80, 11, 146, { rx: 3, fill: "url(#gh)", ...O(c, 1.8) }),
      rect(59, -80, 11, 146, { rx: 3, fill: "url(#gh)", ...O(c, 1.8) }),
      ...Array.from({ length: 8 }, (_, i) => path(`M -50 ${-62 + i * 15} Q 0 ${-50 + i * 15} 50 ${-62 + i * 15}`, { fill: "none", stroke: "url(#gm)", "stroke-width": 8, "stroke-linecap": "round" })),
      rect(-9, -90, 18, 150, { rx: 4, fill: "url(#gh)", ...O(c, 1.8) }),
      rect(-30, 56, 60, 88, { rx: 14, fill: "url(#ga)", ...O(c) }),
      path("M -18 70 Q -20 100 -18 130", { fill: "none", stroke: P.accentHi, "stroke-width": 5, "stroke-linecap": "round", opacity: 0.7 }),
      ellipse(0, 62, 82, 17, { fill: "url(#gm)", ...O(c) }),
      ellipse(0, 62, 40, 8, { fill: "url(#gd)", ...O(c, 1.6) }),
      ellipse(0, -88, 118, 26, { fill: "url(#gm)", ...O(c, 2.4) }),
      ellipse(0, -88, 74, 14, { fill: "url(#gd)", ...O(c, 1.8) }),
      circle(-96, -88, 7, { fill: P.rubber, ...O(c, 1.4) }),
      circle(96, -88, 7, { fill: P.rubber, ...O(c, 1.4) }),
      rect(-7, -142, 14, 54, { rx: 3, fill: "url(#gh)", ...O(c, 1.6) }),
      circle(0, -148, 12, { fill: "url(#ga)", ...O(c, 1.8) }),
      path("M -102 -82 Q 0 -60 102 -82", { fill: "none", stroke: P.accent, "stroke-width": 4, "stroke-linecap": "round", opacity: 0.9 }),
    ],
    { transform: "translate(0 10) scale(0.97)" },
  );
}

export function fan(c: Ctx): string {
  const { P } = c;
  const blades = pickBlades(c);
  return g([
    path("M -160 -140 H 140 Q 168 -140 168 -112 V 140 H -132 Q -160 140 -160 112 Z", { fill: "url(#gd)", ...O(c, 2.6) }),
    circle(0, 0, 128, { fill: P.rubber, ...O(c, 1.8) }),
    ...Array.from({ length: blades }, (_, i) => {
      const a = (i * 360) / blades;
      return path("M 0 0 C 14 -40 40 -88 78 -112 C 100 -122 116 -100 100 -78 C 76 -44 40 -16 0 0 Z", { fill: "url(#gm)", ...O(c, 1.6), transform: `rotate(${a})` });
    }),
    circle(0, 0, 36, { fill: "url(#ga)", ...O(c) }),
    circle(0, 0, 14, { fill: P.rubber }),
    ...[[-140, -120], [148, -120], [-140, 120], [148, 120]].map(([x, y]) => circle(x!, y!, 7, { fill: P.rubber, ...O(c, 1.4) })),
    circle(0, 0, 130, { fill: "none", stroke: P.metalLo, "stroke-width": 3, opacity: 0.7 }),
  ]);
}

function pickBlades(c: Ctx): number {
  return [7, 9, 5, 7][c.n % 4]!;
}

export function cap(c: Ctx): string {
  const { P } = c;
  return g(
    [
      ellipse(0, -96, 98, 26, { fill: "url(#gm)", ...O(c, 2.4) }),
      rect(-98, -96, 196, 40, { fill: "url(#gh)", ...O(c, 2.4) }),
      ellipse(0, -56, 98, 26, { fill: "url(#gd)", ...O(c, 2.4) }),
      ...Array.from({ length: 22 }, (_, i) => line(-92 + i * 8.4, -92, -92 + i * 8.4, -58, { stroke: P.stroke, "stroke-width": 1.4, opacity: 0.4 })),
      ellipse(0, -96, 98, 26, { fill: "url(#gm)", ...O(c, 2.4) }),
      path("M -50 -102 Q 0 -122 50 -102", { fill: "none", stroke: P.accent, "stroke-width": 6, "stroke-linecap": "round" }),
      rect(-72, -34, 144, 14, { rx: 5, fill: "url(#gm)", ...O(c) }),
      ...Array.from({ length: 6 }, (_, i) => path(`M -34 ${-18 + i * 18} Q 0 ${-6 + i * 18} 34 ${-18 + i * 18}`, { fill: "none", stroke: "url(#gm)", "stroke-width": 7, "stroke-linecap": "round" })),
      ellipse(0, 108, 74, 18, { fill: "url(#gr)", ...O(c) }),
      ellipse(0, 100, 56, 12, { fill: P.rubber }),
    ],
    { transform: "translate(0 14)" },
  );
}

export function tank(c: Ctx): string {
  const { P } = c;
  return g(
    [
      rect(-26, -170, 52, 36, { rx: 6, fill: "url(#gd)", ...O(c) }),
      rect(-34, -140, 68, 18, { rx: 5, fill: "url(#gm)", ...O(c, 1.8) }),
      path("M -150 -110 Q -150 -128 -132 -128 H 112 Q 136 -128 140 -100 L 150 100 Q 150 124 126 124 H -122 Q -148 124 -150 98 Z", { fill: "url(#gg)", ...O(c, 2.6) }),
      path("M -146 -20 H 146 L 150 98 Q 150 120 126 120 H -122 Q -146 120 -146 96 Z", { fill: P.accent, opacity: 0.8 }),
      path("M -146 -20 Q -80 -34 0 -20 T 146 -20", { fill: "none", stroke: P.accentHi, "stroke-width": 4 }),
      ...[[-60, "MAX"], [20, "MIN"]].map(([y, t]) => g([line(-150, y as number, -110, y as number, { stroke: P.stroke, "stroke-width": 3 }), text(-104, (y as number) + 6, t as string, { "font-family": "Arial,sans-serif", "font-size": 16, fill: P.stroke, "font-weight": 700, opacity: 0.75 })])),
      rect(150, -20, 44, 22, { rx: 6, fill: "url(#gd)", ...O(c, 1.8) }),
      rect(-190, 70, 44, 22, { rx: 6, fill: "url(#gd)", ...O(c, 1.8) }),
      path("M -128 -110 Q -140 -60 -132 -30", { fill: "none", stroke: P.paper, "stroke-width": 8, "stroke-linecap": "round", opacity: 0.55 }),
    ],
    { transform: "translate(0 10) scale(0.96)" },
  );
}

/* ------------------------------------------------------------------ body */

export function wiper(c: Ctx, rear = false): string {
  const { P } = c;
  const blade = (x: number, y: number, rot: number, len: number, arm: boolean) =>
    g(
      [
        arm ? path(`M ${-len / 2 + 20} 6 L ${-len / 2 - 70} 96`, { fill: "none", stroke: P.dark, "stroke-width": 9, "stroke-linecap": "round" }) : "",
        arm ? rect(-24, -16, 48, 26, { rx: 6, fill: "url(#gr)", ...O(c, 1.8) }) : "",
        path(`M ${-len / 2} 6 Q 0 -10 ${len / 2} 6 L ${len / 2} 14 Q 0 -2 ${-len / 2} 14 Z`, { fill: "url(#gd)", ...O(c, 1.8) }),
        path(`M ${-len / 2 + 4} 14 Q 0 -2 ${len / 2 - 4} 14 L ${len / 2 - 4} 19 Q 0 3 ${-len / 2 + 4} 19 Z`, { fill: P.rubber }),
        rect(-14, -6, 28, 18, { rx: 5, fill: "url(#ga)", ...O(c, 1.6) }),
        path(`M ${-len / 2 + 14} 4 Q 0 -10 ${len / 2 - 14} 4`, { fill: "none", stroke: P.metalHi, "stroke-width": 1.6, opacity: 0.6 }),
      ],
      { transform: `translate(${x} ${y}) rotate(${rot})` },
    );
  if (rear) return g([blade(10, 20, -18, 300, true)]);
  return g([blade(10, -70, -14, 340, true), blade(0, 54, -14, 300, false)]);
}

export function mirror(c: Ctx): string {
  const { P } = c;
  return g(
    [
      path("M -170 -86 Q -170 -108 -146 -108 H 70 Q 170 -90 172 20 Q 170 100 90 108 H -146 Q -170 108 -170 86 Z", { fill: "url(#gd)", ...O(c, 2.6) }),
      path("M -156 -76 Q -156 -92 -140 -92 H 64 Q 154 -78 156 20 Q 154 88 84 94 H -140 Q -156 94 -156 78 Z", { fill: "url(#gg)", ...O(c, 1.8) }),
      path("M -156 -76 Q -156 -92 -140 -92 H 64 Q 154 -78 156 20 Q 154 88 84 94 H -140 Q -156 94 -156 78 Z", { fill: P.paper, opacity: P.mode === "light" ? 0.28 : 0.1 }),
      path("M -120 -70 L 20 -90 L -60 88 L -140 88 Z", { fill: P.paper, opacity: 0.4 }),
      path("M 60 -82 L 100 -80 L 10 90 L -20 90 Z", { fill: P.paper, opacity: 0.22 }),
      path("M 108 -70 Q 144 -50 150 20", { fill: "none", stroke: P.accent, "stroke-width": 4, opacity: 0.9 }),
      path("M 100 40 l 14 -14 l 14 14 l 14 -14", { fill: "none", stroke: P.accent, "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round" }),
    ],
    { transform: "rotate(-6)" },
  );
}

export function mat(c: Ctx): string {
  const { P } = c;
  const shape = "M -90 -176 H 80 Q 120 -176 120 -138 V 20 Q 120 44 150 70 Q 170 90 168 124 Q 166 176 126 176 H -110 Q -150 176 -150 138 V -100 Q -150 -176 -90 -176 Z";
  return g(
    [
      path(shape, { fill: "url(#gd)", ...O(c, 2.6) }),
      path(shape, { fill: "none", stroke: P.accent, "stroke-width": 4, "stroke-dasharray": "10 6", transform: "scale(0.93) translate(2 6)" }),
      ...Array.from({ length: 14 }, (_, i) => line(-124, -140 + i * 22, 100, -140 + i * 22, { stroke: P.metalLo, "stroke-width": 3.4, opacity: 0.5, "stroke-linecap": "round" })),
      path("M -100 70 Q -10 40 90 70 Q 20 110 -100 70 Z", { fill: P.rubber, opacity: 0.8, ...O(c, 1.4) }),
      rect(-70, 120, 120, 14, { rx: 7, fill: P.accent, opacity: 0.95 }),
    ],
    { transform: "rotate(-4) scale(0.96)" },
  );
}

export function flap(c: Ctx): string {
  const { P } = c;
  return g(
    [
      path("M -90 -170 H 90 V 100 Q 90 170 40 172 H -40 Q -90 170 -90 100 Z", { fill: "url(#gd)", ...O(c, 2.6) }),
      rect(-90, -170, 180, 40, { rx: 6, fill: "url(#gr)", ...O(c, 1.8) }),
      circle(-60, -150, 7, { fill: P.metal, ...O(c, 1.4) }),
      circle(60, -150, 7, { fill: P.metal, ...O(c, 1.4) }),
      ...Array.from({ length: 9 }, (_, i) => line(-74, -100 + i * 22, 74, -100 + i * 22, { stroke: P.metalLo, "stroke-width": 3, opacity: 0.35, "stroke-linecap": "round" })),
      path("M -50 60 L 0 20 L 50 60 L 0 40 Z", { fill: P.accent, ...O(c, 1.4) }),
      rect(-90, 112, 180, 12, { fill: P.accent, opacity: 0.9 }),
    ],
    { transform: "rotate(8) scale(0.98)" },
  );
}

export function handle(c: Ctx): string {
  const { P } = c;
  return g(
    [
      path("M -170 -40 Q -170 -66 -140 -66 H 140 Q 170 -66 170 -40 V -20 Q 170 -4 150 -4 H -150 Q -170 -4 -170 -20 Z", { fill: "url(#gd)", ...O(c, 2.6) }),
      path("M -150 -52 H 150", { stroke: P.metalHi, "stroke-width": 4, opacity: 0.4, "stroke-linecap": "round" }),
      path("M -120 -4 Q -120 50 -90 50 H 90 Q 120 50 120 -4", { fill: "url(#gm)", ...O(c, 2.4) }),
      path("M -112 6 Q -110 40 -84 40 H 84 Q 110 40 112 6", { fill: "none", stroke: P.metalHi, "stroke-width": 3, opacity: 0.6 }),
      circle(-140, 50, 22, { fill: "url(#gh)", ...O(c) }),
      circle(-140, 50, 8, { fill: P.rubber }),
      rect(-146, 44, 12, 4, { fill: P.rubber }),
      rect(118, 36, 40, 28, { rx: 6, fill: "url(#gm)", ...O(c, 1.8) }),
      circle(138, 50, 6, { fill: P.rubber }),
      rect(-60, -66, 120, 10, { rx: 5, fill: P.accent, opacity: 0.95 }),
    ],
    { transform: "translate(0 10) rotate(-6)" },
  );
}

/* ------------------------------------------------------------------ fluids */

type ContainerKind = "oilbottle" | "bottle" | "jug" | "canwasher";

export function container(c: Ctx, kind: ContainerKind): string {
  const { P } = c;
  const label = (x: number, y: number, w: number, h: number) =>
    g([
      rect(x, y, w, h, { rx: 6, fill: P.paper, ...O(c, 1.4) }),
      rect(x, y, w, h * 0.34, { rx: 6, fill: "url(#ga)" }),
      rect(x, y + h * 0.2, w, h * 0.14, { fill: "url(#ga)" }),
      line(x + 14, y + h * 0.58, x + w - 14, y + h * 0.58, { stroke: P.stroke, "stroke-width": 5, opacity: 0.75, "stroke-linecap": "round" }),
      line(x + 14, y + h * 0.78, x + w * 0.62, y + h * 0.78, { stroke: P.stroke, "stroke-width": 4, opacity: 0.45, "stroke-linecap": "round" }),
    ]);
  if (kind === "oilbottle") {
    return g([
      path("M -62 -60 Q -62 -90 -34 -108 V -150 H 14 V -108 Q 62 -90 62 -60 V 150 Q 62 172 38 172 H -38 Q -62 172 -62 150 Z", { fill: "url(#gah)", ...O(c, 2.6) }),
      rect(-38, -176, 62, 34, { rx: 6, fill: "url(#gd)", ...O(c) }),
      path("M 30 -170 Q 96 -170 96 -108 V 20 Q 96 40 70 40", { fill: "none", stroke: "url(#gah)", "stroke-width": 20, "stroke-linecap": "round" }),
      label(-52, -30, 104, 150),
      path("M -50 -70 Q -56 -50 -52 -36", { fill: "none", stroke: P.metalHi, "stroke-width": 6, opacity: 0.5, "stroke-linecap": "round" }),
    ], { transform: "translate(-10 0)" });
  }
  if (kind === "bottle") {
    return g([
      path("M -56 -50 Q -56 -84 -26 -100 V -140 H 26 V -100 Q 56 -84 56 -50 V 146 Q 56 168 34 168 H -34 Q -56 168 -56 146 Z", { fill: "url(#gg)", ...O(c, 2.6) }),
      path("M -52 -20 H 52 V 146 Q 52 164 34 164 H -34 Q -52 164 -52 146 Z", { fill: P.accent, opacity: 0.55 }),
      rect(-34, -168, 68, 40, { rx: 7, fill: "url(#ga)", ...O(c) }),
      ...Array.from({ length: 9 }, (_, i) => line(-26 + i * 6.5, -164, -26 + i * 6.5, -132, { stroke: P.stroke, "stroke-width": 1.2, opacity: 0.4 })),
      label(-46, 10, 92, 120),
    ]);
  }
  if (kind === "jug") {
    return g([
      path("M -110 -40 Q -110 -78 -76 -86 H 56 Q 110 -80 110 -30 V 140 Q 110 168 82 168 H -82 Q -110 168 -110 140 Z", { fill: "url(#gg)", ...O(c, 2.6) }),
      path("M -106 -20 H 106 V 140 Q 106 164 82 164 H -82 Q -106 164 -106 140 Z", { fill: P.accent, opacity: 0.6 }),
      rect(-30, -118, 70, 36, { rx: 8, fill: "url(#ga)", ...O(c) }),
      path("M -80 -80 Q -80 -134 -36 -134 H 20", { fill: "none", stroke: "url(#gd)", "stroke-width": 20, "stroke-linecap": "round" }),
      label(-80, 0, 160, 130),
      path("M -100 -50 Q -104 -20 -100 20", { fill: "none", stroke: P.paper, "stroke-width": 7, opacity: 0.5, "stroke-linecap": "round" }),
    ]);
  }
  return g([
    path("M -100 -40 Q -100 -64 -76 -64 H 76 Q 100 -64 100 -40 V 140 Q 100 164 76 164 H -76 Q -100 164 -100 140 Z", { fill: "url(#gg)", ...O(c, 2.6) }),
    path("M -96 -10 H 96 V 140 Q 96 160 76 160 H -76 Q -96 160 -96 140 Z", { fill: "#4f8cff", opacity: 0.5 }),
    rect(-34, -98, 68, 36, { rx: 8, fill: "url(#ga)", ...O(c) }),
    path("M -90 -64 Q -90 -130 -20 -130", { fill: "none", stroke: "url(#gd)", "stroke-width": 20, "stroke-linecap": "round" }),
    label(-70, 10, 140, 110),
  ]);
}

export function gasstrut(c: Ctx): string {
  return shockLike(c);
}

function shockLike(c: Ctx): string {
  const { P } = c;
  return g(
    [
      circle(-168, 0, 18, { fill: "url(#gd)", ...O(c) }),
      circle(-168, 0, 7, { fill: P.metal }),
      rect(-150, -15, 150, 30, { rx: 8, fill: "url(#gh)", ...O(c) }),
      rect(-70, -16, 14, 32, { fill: "url(#ga)", ...O(c, 1.4) }),
      rect(0, -6, 150, 12, { rx: 4, fill: "url(#gh)", ...O(c, 1.8) }),
      circle(168, 0, 18, { fill: "url(#gd)", ...O(c) }),
      circle(168, 0, 7, { fill: P.metal }),
    ],
    { transform: "rotate(-16)" },
  );
}
