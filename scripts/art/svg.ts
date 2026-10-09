/**
 * Tiny SVG builder + palettes for the generated product art. Pure and deterministic (no randomness, no dates).
 * Part drawings live in a 400 x 400 box centred on (0, 0); compose.ts places them on the canvas.
 */

export type Attrs = Record<string, string | number | undefined>;

const round = (n: number) => Math.round(n * 100) / 100;

function attrString(attrs?: Attrs): string {
  if (!attrs) return "";
  let out = "";
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined) continue;
    out += ` ${k}="${typeof v === "number" ? round(v) : v}"`;
  }
  return out;
}

export function el(tag: string, attrs?: Attrs, inner?: string | string[]): string {
  const content = Array.isArray(inner) ? inner.join("") : inner;
  return content ? `<${tag}${attrString(attrs)}>${content}</${tag}>` : `<${tag}${attrString(attrs)}/>`;
}

export const g = (inner: string | string[], attrs?: Attrs) => el("g", attrs, inner);
export const rect = (x: number, y: number, w: number, h: number, attrs: Attrs = {}) => el("rect", { x, y, width: w, height: h, ...attrs });
export const circle = (cx: number, cy: number, r: number, attrs: Attrs = {}) => el("circle", { cx, cy, r, ...attrs });
export const ellipse = (cx: number, cy: number, rx: number, ry: number, attrs: Attrs = {}) => el("ellipse", { cx, cy, rx, ry, ...attrs });
export const path = (d: string, attrs: Attrs = {}) => el("path", { d, ...attrs });
export const line = (x1: number, y1: number, x2: number, y2: number, attrs: Attrs = {}) => el("line", { x1, y1, x2, y2, ...attrs });
export const polygon = (points: [number, number][], attrs: Attrs = {}) => el("polygon", { points: points.map(([x, y]) => `${round(x)},${round(y)}`).join(" "), ...attrs });
export const text = (x: number, y: number, content: string, attrs: Attrs = {}) => el("text", { x, y, ...attrs }, escapeXml(content));

export function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Points on a circle, starting at `start` radians. */
export function ring(cx: number, cy: number, r: number, n: number, start = -Math.PI / 2): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = start + (i * 2 * Math.PI) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number];
  });
}

/** Regular hexagon (nuts, hex flanges). */
export const hexagon = (cx: number, cy: number, r: number, attrs: Attrs = {}) => polygon(ring(cx, cy, r, 6, 0), attrs);

/* ------------------------------------------------------------------ palettes */

export type Tier = "value" | "standard" | "premium" | "performance";

export interface Palette {
  mode: "light" | "dark";
  bg: string;
  metalHi: string;
  metal: string;
  metalLo: string;
  steel: string;
  dark: string;
  rubber: string;
  stroke: string;
  paper: string;
  glass: string;
  accent: string;
  accentHi: string;
  accentLo: string;
  glow: string;
  muted: string;
}

const ACCENTS: Record<Tier, [string, string, string]> = {
  performance: ["#ff5a1f", "#ff8d5e", "#c13d0b"],
  standard: ["#ff6a2d", "#ff9966", "#c8470f"],
  premium: ["#ffb020", "#ffd073", "#c78200"],
  value: ["#6f7d92", "#9eabbf", "#48536a"],
};

export function palette(mode: "light" | "dark", tier: Tier): Palette {
  const [accent, accentHi, accentLo] = ACCENTS[tier];
  if (mode === "light") {
    return {
      mode,
      bg: "#f4f5f7",
      metalHi: "#fbfcfd",
      metal: "#c3c9d2",
      metalLo: "#7a8493",
      steel: "#5a6472",
      dark: "#2b313a",
      rubber: "#1d2127",
      stroke: "#14171c",
      paper: "#ffffff",
      glass: "#dbe9f5",
      accent,
      accentHi,
      accentLo,
      glow: "#ffd27a",
      muted: "#9aa3b0",
    };
  }
  return {
    mode,
    bg: "#14171c",
    metalHi: "#f1f3f6",
    metal: "#aab3bf",
    metalLo: "#5c6776",
    steel: "#8d97a6",
    dark: "#3a424d",
    rubber: "#2a313b",
    stroke: "#06080a",
    paper: "#f4f5f7",
    glass: "#31475c",
    accent,
    accentHi,
    accentLo,
    glow: "#ffb020",
    muted: "#5c6776",
  };
}

/** Shared gradient defs. Reference as url(#id). */
export function defs(P: Palette): string {
  const stop = (o: number, c: string, op?: number) => el("stop", { offset: `${o}%`, "stop-color": c, "stop-opacity": op });
  const lin = (id: string, vertical: boolean, stops: string[]) =>
    el("linearGradient", { id, x1: 0, y1: 0, x2: vertical ? 0 : 1, y2: vertical ? 1 : 0 }, stops);
  return el("defs", undefined, [
    lin("gm", true, [stop(0, P.metalHi), stop(55, P.metal), stop(100, P.metalLo)]),
    lin("gh", false, [stop(0, P.metalLo), stop(35, P.metalHi), stop(65, P.metal), stop(100, P.metalLo)]),
    lin("ga", true, [stop(0, P.accentHi), stop(50, P.accent), stop(100, P.accentLo)]),
    lin("gah", false, [stop(0, P.accentLo), stop(35, P.accentHi), stop(70, P.accent), stop(100, P.accentLo)]),
    lin("gr", false, [stop(0, P.stroke), stop(40, P.rubber), stop(70, P.dark), stop(100, P.stroke)]),
    lin("gd", true, [stop(0, P.dark), stop(100, P.rubber)]),
    lin("gp", true, [stop(0, P.paper), stop(100, P.metal)]),
    lin("gg", true, [stop(0, P.glass, 0.95), stop(100, P.glass, 0.45)]),
    el("radialGradient", { id: "gglow", cx: "50%", cy: "50%", r: "50%" }, [stop(0, P.glow, 0.95), stop(60, P.glow, 0.35), stop(100, P.glow, 0)]),
    el("radialGradient", { id: "gshadow", cx: "50%", cy: "50%", r: "50%" }, [stop(0, "#000000", P.mode === "light" ? 0.28 : 0.6), stop(100, "#000000", 0)]),
    el("radialGradient", { id: "gdisc", cx: "50%", cy: "45%", r: "60%" }, [stop(0, P.metalHi), stop(70, P.metal), stop(100, P.metalLo)]),
  ]);
}

/** Common stroke style for shapes. */
export const outline = (P: Palette, w = 2.2): Attrs => ({ stroke: P.stroke, "stroke-width": w, "stroke-linejoin": "round", "stroke-linecap": "round" });
