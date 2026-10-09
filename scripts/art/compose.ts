/**
 * Compositions: product hero/detail cards, category tiles, brand badges and home banners.
 * Everything uses brand colours from src/config/brand.ts and is deterministic.
 */
import { brand } from "../../src/config/brand";
import { alternator, battery, bulb, cap, cat, charger, clamp, container, fan, flap, flexpipe, foglight, fuses, gasstrut, handle, headlight, interior, lambda, led, mat, mirror, muffler, pipe, pump, radiator, relay, starter, tank, taillight, thermostat, wiper } from "./parts-b";
import { airfilter, arm, balljoint, bearing, belt, bushing, caliper, coil, disc, fuelfilter, gasket, hose, link, maf, mount, oilfilter, pad, pan, plug, sensor, shoe, shock, spring, strut, timingkit, type Ctx } from "./parts-a";
import { centerlines, defsFor, dimH, dimV, leader, measure, registration, restyle, sheetGrid, theme, titleBlock, type Mode, type Theme } from "./blueprint";
import { circle, escapeXml, g, line, palette, path, polygon, rect, text, type Palette, type Tier } from "./svg";

export type Draw = (c: Ctx) => string;

export const DRAW: Record<string, Draw> = {
  pad,
  shoe,
  disc: (c) => disc(c, false),
  discSlotted: (c) => disc(c, true),
  caliper,
  hose,
  sensor,
  plug,
  coil,
  timingkit,
  belt,
  gasket,
  mount,
  maf,
  shock: (c) => shock(c, false),
  gasstrut: (c) => gasstrut(c),
  strut,
  spring,
  arm,
  link,
  balljoint,
  bearing,
  bushing,
  oilfilter: (c) => oilfilter(c, false),
  oilcart: (c) => oilfilter(c, true),
  airfilter: (c) => airfilter(c, "panel"),
  airperf: (c) => airfilter(c, "perf"),
  cabinfilter: (c) => airfilter(c, "cabin"),
  fuelfilter,
  transfilter: pan,
  bulb: (c) => bulb(c, "h7"),
  bulbsmall: (c) => bulb(c, "small"),
  hid: (c) => bulb(c, "hid"),
  led,
  headlight,
  taillight,
  foglight,
  interior,
  battery,
  alternator,
  starter,
  charger: (c) => charger(c, false),
  jumpstarter: (c) => charger(c, true),
  fuse: fuses,
  relay,
  muffler,
  cat,
  flexpipe,
  pipe,
  lambda,
  clamp,
  radiator,
  pump,
  thermostat,
  fan,
  cap,
  tank,
  wiper: (c) => wiper(c, false),
  wiperrear: (c) => wiper(c, true),
  mirror,
  mat,
  flap,
  handle,
  oilbottle: (c) => container(c, "oilbottle"),
  bottle: (c) => container(c, "bottle"),
  jug: (c) => container(c, "jug"),
  canwasher: (c) => container(c, "canwasher"),
};

const FONT = "'Barlow Condensed','Arial Narrow',Arial,sans-serif";
const MONO = "'JetBrains Mono','Consolas','Courier New',monospace";

function svgOpen(w: number, h: number, title: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img"><title>${escapeXml(title)}</title>`;
}

interface Placed {
  markup: string;
  /** Part extents on the sheet. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  cx: number;
  cy: number;
}

/** Draws a part, restyles it to line art and fits it into a (maxW x maxH) region centred on (cx, cy). */
function place(kind: string, tier: Tier, seed: number, mode: Mode, cx: number, cy: number, maxW: number, maxH: number): { placed: Placed; th: Theme } {
  const draw = DRAW[kind];
  if (!draw) throw new Error(`No drawing for art kind "${kind}"`);
  const P = palette("light", tier);
  const th = theme(mode, P.accent);
  const raw = draw({ P, n: seed });
  const box = measure(raw);
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  const s = Math.min(maxW / w, maxH / h, 2.1);
  const tx = cx - (s * (box.x0 + box.x1)) / 2;
  const ty = cy - (s * (box.y0 + box.y1)) / 2;
  return {
    th,
    placed: {
      markup: g(restyle(raw, P, th), { transform: `translate(${tx} ${ty}) scale(${s})` }),
      x0: cx - (w * s) / 2,
      x1: cx + (w * s) / 2,
      y0: cy - (h * s) / 2,
      y1: cy + (h * s) / 2,
      cx,
      cy,
    },
  };
}

const scaleLabel = (seed: number) => ["1:1", "1:2", "1:2", "2:1", "1:4"][seed % 5] as string;
const revLabel = (seed: number) => String.fromCharCode(65 + (seed % 5));

/* ------------------------------------------------------------------ product sheets */

/**
 * View 1: orthographic elevation on drawing paper. Dimension lines run to the real extents of the part and carry
 * numbered bubbles that match the specification rows on the product page (see src/lib/spec-dims.ts).
 */
export function renderHero(kind: string, tier: Tier, seed: number, title: string, partNumber: string, dims: number): string {
  const { placed: p, th } = place(kind, tier, seed, "paper", 400, 340, 530, 440);
  const callouts: string[] = [];
  callouts.push(dimH(th, p.x0, p.x1, p.y1 + 54, p.y1, dims >= 1 ? "1" : undefined));
  callouts.push(dimV(th, p.y0, p.y1, p.x1 + 54, p.x1, dims >= 2 ? "2" : undefined));
  if (dims >= 3) callouts.push(leader(th, p.cx + (p.x1 - p.x0) * 0.16, p.cy - (p.y1 - p.y0) * 0.14, p.x0 - 22, p.y0 - 18, "3"));
  return [
    svgOpen(800, 800, title),
    defsFor(th),
    rect(0, 0, 800, 800, { fill: th.bg }),
    sheetGrid(th, 800, 800),
    registration(th, 800, 800),
    centerlines(th, p.cx, p.cy, (p.x1 - p.x0) / 2 + 34, (p.y1 - p.y0) / 2 + 34),
    p.markup,
    ...callouts,
    titleBlock(th, 800, 800, { part: partNumber, fig: "1", scale: scaleLabel(seed), rev: revLabel(seed) }),
    "</svg>",
  ].join("");
}

/** View 2: the same part as a labelled section drawing on graphite, with a cutting plane A-A. */
export function renderDetail(kind: string, tier: Tier, seed: number, title: string, partNumber: string, code: string): string {
  const { placed: p, th } = place(kind, tier, seed, "blue", 400, 342, 540, 440);
  const half = (p.x1 - p.x0) / 2;
  const cut = (x: number, label: string) =>
    g([
      polygon([[x, p.cy - 8], [x + (x < p.cx ? -14 : 14), p.cy], [x, p.cy + 8]], { fill: th.accent }),
      text(x + (x < p.cx ? -24 : 24), p.cy + 7, label, { "text-anchor": x < p.cx ? "end" : "start", "font-family": MONO, "font-size": 20, "font-weight": 700, fill: th.accent }),
    ]);
  const cx0 = p.cx - half - 30;
  const cx1 = p.cx + half + 30;
  return [
    svgOpen(800, 800, title),
    defsFor(th),
    rect(0, 0, 800, 800, { fill: th.bg }),
    sheetGrid(th, 800, 800),
    registration(th, 800, 800),
    p.markup,
    line(cx0, p.cy, cx1, p.cy, { stroke: th.accent, "stroke-width": 1.6, "stroke-dasharray": "26 6 4 6" }),
    cut(cx0, "A"),
    cut(cx1, "A"),
    dimH(th, p.x0, p.x1, p.y0 - 44, p.y0),
    leader(th, p.cx - (p.x1 - p.x0) * 0.2, p.cy + (p.y1 - p.y0) * 0.22, p.x0 - 20, p.y1 + 22, "B"),
    leader(th, p.cx + (p.x1 - p.x0) * 0.26, p.cy + (p.y1 - p.y0) * 0.1, p.x1 + 20, p.y1 + 22, "C"),
    text(60, 98, brand.name, { "font-family": FONT, "font-size": 26, "font-weight": 700, "letter-spacing": 5, fill: th.ink, opacity: 0.9 }),
    text(60, 122, `SECTION A-A  /  ${code}`, { "font-family": MONO, "font-size": 14, fill: th.accent, "letter-spacing": 2 }),
    titleBlock(th, 800, 800, { part: partNumber, fig: "2", scale: scaleLabel(seed + 1), rev: revLabel(seed) }),
    "</svg>",
  ].join("");
}

/* ------------------------------------------------------------------ categories */

const CATEGORY_HERO: Record<string, string> = {
  brakes: "disc",
  engine: "timingkit",
  suspension: "strut",
  filters: "oilfilter",
  lighting: "headlight",
  electrical: "battery",
  exhaust: "muffler",
  cooling: "radiator",
  body: "wiper",
  fluids: "oilbottle",
};

/** Category plates (1200 x 800): a single part as a graphite blueprint with centrelines and one overall dimension. */
export function renderCategory(slug: string, title: string): string {
  const kind = CATEGORY_HERO[slug];
  if (!kind) throw new Error(`No hero part for category "${slug}"`);
  const { placed: p, th } = place(kind, "performance", 3, "blue", 600, 372, 840, 520);
  return [
    svgOpen(1200, 800, title),
    defsFor(th),
    rect(0, 0, 1200, 800, { fill: th.bg }),
    sheetGrid(th, 1200, 800),
    registration(th, 1200, 800, 36),
    centerlines(th, p.cx, p.cy, (p.x1 - p.x0) / 2 + 44, (p.y1 - p.y0) / 2 + 44),
    p.markup,
    dimH(th, p.x0, p.x1, p.y1 + 62, p.y1),
    dimV(th, p.y0, p.y1, p.x1 + 62, p.x1),
    "</svg>",
  ].join("");
}

/* ------------------------------------------------------------------ brand badges */

function glyph(P: Palette, style: number, color: string): string {
  switch (style % 6) {
    case 0:
      return path("M -30 22 L 0 -26 L 30 22 L 14 22 L 0 0 L -14 22 Z", { fill: color });
    case 1:
      return g([circle(0, 0, 28, { fill: "none", stroke: color, "stroke-width": 8 }), circle(0, 0, 8, { fill: color })]);
    case 2:
      return g([polygon([[-30, 24], [-10, 24], [14, -24], [-6, -24]], { fill: color }), polygon([[2, 24], [22, 24], [46, -24], [26, -24]], { fill: color, opacity: 0.6 })]);
    case 3:
      return polygon(Array.from({ length: 6 }, (_, i) => [Math.cos((i * Math.PI) / 3) * 30, Math.sin((i * Math.PI) / 3) * 30] as [number, number]), { fill: "none", stroke: color, "stroke-width": 8, "stroke-linejoin": "round" });
    case 4:
      return g([polygon([[0, -30], [30, 0], [0, 30], [-30, 0]], { fill: color }), polygon([[0, -12], [12, 0], [0, 12], [-12, 0]], { fill: P.bg })]);
    default:
      return g([rect(-30, -24, 60, 10, { rx: 3, fill: color }), rect(-30, -5, 44, 10, { rx: 3, fill: color, opacity: 0.75 }), rect(-30, 14, 28, 10, { rx: 3, fill: color, opacity: 0.5 })]);
  }
}

export function renderBrand(name: string, country: string, seed: number): string {
  const P = palette("dark", "performance");
  const color = seed % 2 === 0 ? P.accent : "#ffb020";
  const label = name.toUpperCase();
  const width = Math.min(278, label.length * 28);
  return [
    svgOpen(480, 200, `${name} logo`),
    rect(0, 0, 480, 200, { rx: 4, fill: P.bg }),
    rect(6, 6, 468, 188, { rx: 2, fill: "none", stroke: P.paper, "stroke-width": 1.5, opacity: 0.14 }),
    g(glyph(P, seed, color), { transform: "translate(84 100) scale(1.35)" }),
    line(148, 52, 148, 148, { stroke: P.paper, "stroke-width": 1.5, opacity: 0.2 }),
    text(172, 112, label, { "font-family": FONT, "font-size": 52, "font-weight": 700, fill: P.paper, "letter-spacing": 3, textLength: width, lengthAdjust: "spacingAndGlyphs" }),
    text(172, 142, `EST. ${country}`, { "font-family": MONO, "font-size": 15, fill: color, "letter-spacing": 4 }),
    "</svg>",
  ].join("");
}

/* ------------------------------------------------------------------ banners (1600 x 640) */

function bannerShell(th: Theme, title: string, inner: string[]): string {
  return [svgOpen(1600, 640, title), defsFor(th), rect(0, 0, 1600, 640, { fill: th.bg }), sheetGrid(th, 1600, 640), registration(th, 1600, 640, 34), ...inner, "</svg>"].join("");
}

/** A line-art part positioned by centre and target height. */
function bannerPart(kind: string, seed: number, cx: number, cy: number, maxW: number, maxH: number, rot = 0): { markup: string; box: Placed } {
  const draw = DRAW[kind];
  if (!draw) throw new Error(`No drawing for ${kind}`);
  const P = palette("light", "performance");
  const th = theme("blue", P.accent);
  const raw = draw({ P, n: seed });
  const box = measure(raw);
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  const s = Math.min(maxW / w, maxH / h);
  const tx = cx - (s * (box.x0 + box.x1)) / 2;
  const ty = cy - (s * (box.y0 + box.y1)) / 2;
  return {
    markup: g(restyle(raw, P, th), { transform: `rotate(${rot} ${cx} ${cy}) translate(${tx} ${ty}) scale(${s})` }),
    box: { markup: "", x0: cx - (w * s) / 2, x1: cx + (w * s) / 2, y0: cy - (h * s) / 2, y1: cy + (h * s) / 2, cx, cy },
  };
}

function carOutline(th: Theme): string {
  const body = "M 20 150 L 30 120 Q 40 100 80 94 L 150 88 Q 190 50 260 44 L 380 44 Q 440 46 480 88 L 540 96 Q 580 104 586 130 L 590 150 Z";
  return g(
    [
      path(body, { fill: "none", stroke: th.ink, "stroke-width": 2.4, "stroke-linejoin": "round" }),
      path("M 168 88 Q 200 56 262 52 L 300 52 L 300 88 Z M 316 52 L 378 52 Q 420 54 450 88 L 316 88 Z", { fill: "none", stroke: th.detail, "stroke-width": 1.4 }),
      ...[140, 470].map((x) => g([circle(x, 150, 38, { fill: th.bg, stroke: th.ink, "stroke-width": 2.4 }), circle(x, 150, 24, { fill: "none", stroke: th.detail, "stroke-width": 1.4 }), circle(x, 150, 6, { fill: th.accent })])),
      line(0, 188, 620, 188, { stroke: th.detail, "stroke-width": 1, "stroke-dasharray": "10 6" }),
    ],
    { transform: "translate(640 190) scale(1.45)" },
  );
}

export function renderBanner(name: string): string {
  const th = theme("blue", palette("light", "performance").accent);
  const ground = (y: number, x0: number, x1: number) => line(x0, y, x1, y, { stroke: th.detail, "stroke-width": 1, "stroke-dasharray": "10 6" });
  switch (name) {
    case "fitment": {
      const pad = bannerPart("pad", 2, 1180, 520, 150, 100, -4);
      const filter = bannerPart("oilfilter", 3, 1310, 520, 100, 130);
      const plug = bannerPart("plug", 5, 1400, 520, 60, 130);
      const disc = bannerPart("disc", 4, 1500, 520, 110, 110);
      return bannerShell(th, "Find parts for your exact car", [carOutline(th), ground(600, 1050, 1560), pad.markup, filter.markup, plug.markup, disc.markup]);
    }
    case "brakes": {
      const disc = bannerPart("disc", 2, 1180, 320, 420, 420, -8);
      const cal = bannerPart("caliper", 1, 1440, 400, 250, 200, -4);
      const pad = bannerPart("pad", 3, 930, 470, 230, 150, -6);
      return bannerShell(th, "Stop sooner. Stop quieter.", [
        centerlines(th, disc.box.cx, disc.box.cy, 250, 250),
        disc.markup,
        dimH(th, disc.box.x0, disc.box.x1, disc.box.y1 + 38, disc.box.y1, "1"),
        cal.markup,
        pad.markup,
      ]);
    }
    case "service": {
      const bottle = bannerPart("oilbottle", 1, 1070, 330, 200, 300);
      const filter = bannerPart("oilfilter", 2, 1270, 350, 200, 260);
      const air = bannerPart("airfilter", 3, 1470, 330, 200, 250, -4);
      const plug = bannerPart("plug", 4, 1360, 500, 100, 100, 20);
      return bannerShell(th, "Service season", [ground(560, 940, 1560), bottle.markup, filter.markup, air.markup, plug.markup]);
    }
    case "deals": {
      const tag = g(
        [
          path("M -150 -120 H 90 L 170 0 L 90 120 H -150 Q -170 120 -170 100 V -100 Q -170 -120 -150 -120 Z", { fill: th.accentTint, stroke: th.accent, "stroke-width": 3, "stroke-linejoin": "round" }),
          circle(-120, 0, 14, { fill: th.bg, stroke: th.accent, "stroke-width": 2.4 }),
          circle(-40, -44, 22, { fill: "none", stroke: th.accent, "stroke-width": 5 }),
          circle(40, 44, 22, { fill: "none", stroke: th.accent, "stroke-width": 5 }),
          line(70, -66, -70, 66, { stroke: th.accent, "stroke-width": 6, "stroke-linecap": "round" }),
        ],
        { transform: "translate(1150 320) rotate(-12) scale(1.45)" },
      );
      const bat = bannerPart("battery", 1, 1450, 400, 220, 170, 4);
      const lamp = bannerPart("headlight", 2, 1420, 540, 180, 110, -4);
      return bannerShell(th, "This week's deals", [tag, bat.markup, lamp.markup]);
    }
    default: {
      const shield = g(
        [
          path("M 0 -150 L 128 -108 V 12 Q 128 104 0 160 Q -128 104 -128 12 V -108 Z", { fill: th.white, stroke: th.accent, "stroke-width": 3, "stroke-linejoin": "round" }),
          path("M -64 52 L 0 -70 L 64 52 L 32 52 L 0 -2 L -32 52 Z", { fill: th.accent }),
          path("M -86 -100 L 0 -128 L 86 -100", { fill: "none", stroke: th.detail, "stroke-width": 1.4 }),
        ],
        { transform: "translate(1150 270) scale(1.55)" },
      );
      const pad = bannerPart("pad", 1, 1420, 400, 160, 100, -8);
      const cabin = bannerPart("cabinfilter", 2, 1480, 250, 120, 100, 8);
      const wiper = bannerPart("wiper", 3, 940, 470, 200, 90, -4);
      return bannerShell(th, "APEXLINE Select", [shield, pad.markup, cabin.markup, wiper.markup]);
    }
  }
}
