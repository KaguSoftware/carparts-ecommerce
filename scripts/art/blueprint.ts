/**
 * Engineering-drawing treatment for the generated product art.
 *
 * The part drawings in parts-a / parts-b are shaded illustrations (gradients, highlights, drop shadows). Rather than
 * redraw seventy parts, this module restyles their markup into a two-colour technical line drawing: ink outlines at
 * one weight, white / light-grey / hatch fills, and the brand orange as the only accent. It also measures a drawing
 * (bounding box) so dimension lines, centrelines and callouts can be drawn to the real extents of the part.
 */
import { circle, el, escapeXml, g, line, path, polygon, rect, text, type Attrs, type Palette } from "./svg";

export type Mode = "paper" | "blue";

export interface Theme {
  mode: Mode;
  bg: string;
  /** Visible outlines, text. */
  ink: string;
  /** Hidden detail, grid, construction lines. */
  detail: string;
  /** Dimension lines and leaders. */
  dim: string;
  white: string;
  grey: string;
  mid: string;
  slit: string;
  accent: string;
  accentTint: string;
  accentSoft: string;
}

const mix = (a: string, b: string, t: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return "#" + pa.map((v, i) => Math.round(v + ((pb[i] ?? 0) - v) * t).toString(16).padStart(2, "0")).join("");
};

export function theme(mode: Mode, accent: string): Theme {
  if (mode === "paper") {
    return {
      mode,
      bg: "#f1f2f4",
      ink: "#14171c",
      detail: "#7a8493",
      dim: "#2b313a",
      white: "#ffffff",
      grey: "#e1e5ea",
      mid: "#c4cad3",
      slit: "#14171c",
      accent,
      accentTint: mix(accent, "#ffffff", 0.8),
      accentSoft: mix(accent, "#ffffff", 0.55),
    };
  }
  return {
    mode,
    bg: "#14171c",
    ink: "#e8ecf2",
    detail: "#7f8b9c",
    dim: "#aab3bf",
    white: "#1d232b",
    grey: "#262d37",
    mid: "#323a46",
    slit: "#07090b",
    accent,
    accentTint: mix(accent, "#14171c", 0.78),
    accentSoft: mix(accent, "#14171c", 0.5),
  };
}

/* ------------------------------------------------------------------ markup restyle */

interface ParsedTag {
  name: string;
  attrs: Record<string, string>;
  selfClose: boolean;
}

const TAG = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g;
const ATTR = /([\w:-]+)="([^"]*)"/g;

function parseAttrs(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of src.matchAll(ATTR)) out[m[1] as string] = m[2] as string;
  return out;
}

function serialize(name: string, attrs: Record<string, string>, selfClose: boolean): string {
  const a = Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join("");
  return `<${name}${a}${selfClose ? "/" : ""}>`;
}

/**
 * Restyles a part drawing (produced with `palette("light", tier)`) into technical line art.
 * Strokes are normalised to two weights (outline / hairline); shading is removed.
 */
export function restyle(markup: string, P: Palette, th: Theme): string {
  const key = (s: string) => s.toLowerCase();
  const ink = key(P.stroke);
  const rubber = key(P.rubber);
  const metalHi = key(P.metalHi);
  const paper = key(P.paper);
  const metal = key(P.metal);
  const metalLo = key(P.metalLo);
  const steel = key(P.steel);
  const dark = key(P.dark);
  const accents = new Set([key(P.accent), key(P.accentHi), key(P.accentLo)]);
  const glow = key(P.glow);
  const glass = key(P.glass);
  const muted = key(P.muted);

  const fillOf = (v: string): string => {
    const k = key(v);
    if (k === "none") return "none";
    if (k.startsWith("url(")) {
      if (/#(gm|gh|gp|gdisc)\)/.test(k)) return th.white;
      if (/#(gd|gr)\)/.test(k)) return "url(#hatch)";
      if (/#(ga|gah)\)/.test(k)) return th.accentTint;
      if (/#gg\)/.test(k)) return th.grey;
      if (/#gglow\)/.test(k)) return "url(#gglow)";
      if (/#gshadow\)/.test(k)) return "none";
      return th.white;
    }
    if (k === ink) return th.slit;
    if (k === rubber || k === dark) return th.mid;
    if (k === metalHi || k === paper) return th.white;
    if (k === metal) return th.grey;
    if (k === steel || k === muted) return th.mid;
    if (k === metalLo) return th.mid;
    if (accents.has(k)) return th.accent;
    if (k === glow) return th.accentSoft;
    if (k === glass) return th.grey;
    return th.mid;
  };

  const strokeOf = (v: string): string => {
    const k = key(v);
    if (k === "none") return "none";
    if (k.startsWith("url(")) {
      if (/#(ga|gah)\)/.test(k)) return th.accentTint;
      if (/#(gd|gr)\)/.test(k)) return th.ink;
      return th.white;
    }
    if (k === ink || k === rubber || k === dark) return th.ink;
    if (k === metalLo || k === steel || k === muted) return th.detail;
    if (accents.has(k)) return th.accent;
    if (k === glow) return th.accent;
    if (k === metalHi || k === paper || k === metal || k === glass) return th.white;
    return th.detail;
  };

  return markup.replace(TAG, (full: string, closing: string, name: string, attrSrc: string, selfClose: string) => {
    if (closing) return full;
    const tag: ParsedTag = { name, attrs: parseAttrs(attrSrc), selfClose: selfClose === "/" };
    const a = tag.attrs;
    if (name === "g" || name === "svg" || name === "defs" || name === "title" || name === "text") {
      if (name === "g") delete a["opacity"];
      return serialize(name, a, tag.selfClose);
    }

    const opacity = a["opacity"] !== undefined ? Number(a["opacity"]) : 1;
    const origFill = a["fill"];
    const origStroke = a["stroke"];

    // Specular highlights, glints and white-on-white shading strokes vanish in line art.
    if (tag.selfClose) {
      const strokeHi = origStroke && [metalHi, paper].includes(key(origStroke)) && (!origFill || origFill === "none");
      const fillHi = origFill && key(origFill) === metalHi && opacity < 1;
      const shadow = origFill && /#gshadow\)/.test(origFill);
      if (strokeHi || fillHi || shadow) return "";
    }

    if (origFill !== undefined) a["fill"] = fillOf(origFill);
    else if (name !== "line") a["fill"] = th.white; // implicit black fill would be a solid mass
    if (origStroke !== undefined) a["stroke"] = strokeOf(origStroke);

    if (a["stroke"] && a["stroke"] !== "none") {
      const w = a["stroke-width"] !== undefined ? Number(a["stroke-width"]) : 1;
      if (w <= 1.8) a["stroke-width"] = "1.1";
      else if (w <= 7) a["stroke-width"] = "2.4";
      // Thicker strokes build tubes and belts (ink stroke under a white stroke): keep them.
      a["stroke-linejoin"] = a["stroke-linejoin"] ?? "round";
    }
    if (opacity >= 0.78) delete a["opacity"];
    return serialize(name, a, tag.selfClose);
  });
}

/* ------------------------------------------------------------------ measuring */

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

type Mat = [number, number, number, number, number, number];
const ID: Mat = [1, 0, 0, 1, 0, 0];
const mul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

function parseTransform(src: string | undefined): Mat {
  let m = ID;
  if (!src) return m;
  for (const f of src.matchAll(/(translate|rotate|scale)\(([^)]*)\)/g)) {
    const args = (f[2] as string).split(/[\s,]+/).filter(Boolean).map(Number);
    const a = args[0] ?? 0;
    if (f[1] === "translate") m = mul(m, [1, 0, 0, 1, a, args[1] ?? 0]);
    else if (f[1] === "scale") m = mul(m, [a, 0, 0, args[1] ?? a, 0, 0]);
    else {
      const r = (a * Math.PI) / 180;
      const c = Math.cos(r);
      const s = Math.sin(r);
      const rot: Mat = [c, s, -s, c, 0, 0];
      if (args.length >= 3) {
        const cx = args[1] ?? 0;
        const cy = args[2] ?? 0;
        m = mul(mul(mul(m, [1, 0, 0, 1, cx, cy]), rot), [1, 0, 0, 1, -cx, -cy]);
      } else m = mul(m, rot);
    }
  }
  return m;
}

function pathPoints(d: string): [number, number][] {
  const pts: [number, number][] = [];
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  let i = 0;
  let cmd = "";
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  const num = () => Number(tokens[i++]);
  const push = (px: number, py: number) => pts.push([px, py]);
  while (i < tokens.length) {
    const tk = tokens[i] as string;
    if (/[a-zA-Z]/.test(tk)) {
      cmd = tk;
      i++;
      if (cmd === "Z" || cmd === "z") {
        x = sx;
        y = sy;
        continue;
      }
    }
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case "M":
      case "L":
      case "T": {
        x = ox + num();
        y = oy + num();
        push(x, y);
        if (cmd.toUpperCase() === "M") {
          sx = x;
          sy = y;
          cmd = rel ? "l" : "L";
        }
        break;
      }
      case "H":
        x = ox + num();
        push(x, y);
        break;
      case "V":
        y = oy + num();
        push(x, y);
        break;
      case "C": {
        push(ox + num(), oy + num());
        push(ox + num(), oy + num());
        x = ox + num();
        y = oy + num();
        push(x, y);
        break;
      }
      case "S":
      case "Q": {
        push(ox + num(), oy + num());
        x = ox + num();
        y = oy + num();
        push(x, y);
        break;
      }
      case "A": {
        const rx = num();
        const ry = num();
        num();
        num();
        num();
        const nx = ox + num();
        const ny = oy + num();
        // Include the arc's bulge approximately: the midpoint pushed out by the radii.
        push((x + nx) / 2 + (ny - y > 0 ? rx * 0.0 : 0), (y + ny) / 2);
        push(nx, ny);
        void ry;
        x = nx;
        y = ny;
        break;
      }
      default:
        i++;
    }
  }
  return pts;
}

/** Bounding box of a part drawing in its own coordinate space (control points included, so slightly generous). */
export function measure(markup: string): Box {
  const stack: Mat[] = [ID];
  const box: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const add = (m: Mat, px: number, py: number) => {
    const x = m[0] * px + m[2] * py + m[4];
    const y = m[1] * px + m[3] * py + m[5];
    box.x0 = Math.min(box.x0, x);
    box.y0 = Math.min(box.y0, y);
    box.x1 = Math.max(box.x1, x);
    box.y1 = Math.max(box.y1, y);
  };
  for (const m of markup.matchAll(TAG)) {
    const [, closing, name, attrSrc, selfClose] = m as unknown as [string, string, string, string, string];
    if (closing) {
      if (name === "g") stack.pop();
      continue;
    }
    const a = parseAttrs(attrSrc);
    const cur = stack[stack.length - 1] as Mat;
    if (name === "g") {
      if (selfClose !== "/") stack.push(mul(cur, parseTransform(a["transform"])));
      continue;
    }
    if (name === "text" || name === "svg" || name === "defs" || name === "title") continue;
    const mat = a["transform"] ? mul(cur, parseTransform(a["transform"])) : cur;
    const n = (k: string) => Number(a[k] ?? 0);
    const sw = Number(a["stroke-width"] ?? 0) > 7 && a["stroke"] !== "none" ? Number(a["stroke-width"]) / 2 : 0;
    const addPad = (px: number, py: number) => {
      if (sw > 0) {
        add(mat, px - sw, py - sw);
        add(mat, px + sw, py + sw);
      } else add(mat, px, py);
    };
    switch (name) {
      case "circle":
        add(mat, n("cx") - n("r") - sw, n("cy") - n("r") - sw);
        add(mat, n("cx") + n("r") + sw, n("cy") + n("r") + sw);
        add(mat, n("cx") - n("r") - sw, n("cy") + n("r") + sw);
        add(mat, n("cx") + n("r") + sw, n("cy") - n("r") - sw);
        break;
      case "ellipse":
        add(mat, n("cx") - n("rx"), n("cy") - n("ry"));
        add(mat, n("cx") + n("rx"), n("cy") + n("ry"));
        add(mat, n("cx") - n("rx"), n("cy") + n("ry"));
        add(mat, n("cx") + n("rx"), n("cy") - n("ry"));
        break;
      case "rect":
        add(mat, n("x"), n("y"));
        add(mat, n("x") + n("width"), n("y"));
        add(mat, n("x"), n("y") + n("height"));
        add(mat, n("x") + n("width"), n("y") + n("height"));
        break;
      case "line":
        addPad(n("x1"), n("y1"));
        addPad(n("x2"), n("y2"));
        break;
      case "polygon":
      case "polyline":
        for (const p of (a["points"] ?? "").trim().split(/\s+/)) {
          const [px, py] = p.split(",").map(Number);
          if (px !== undefined && py !== undefined) addPad(px, py);
        }
        break;
      case "path":
        for (const [px, py] of pathPoints(a["d"] ?? "")) addPad(px, py);
        break;
    }
  }
  if (!Number.isFinite(box.x0)) return { x0: -200, y0: -200, x1: 200, y1: 200 };
  return box;
}

/* ------------------------------------------------------------------ drawing furniture */

const MONO = "'JetBrains Mono','Consolas','Courier New',monospace";

export function defsFor(th: Theme): string {
  const hatchLine = th.mode === "paper" ? "#8791a0" : "#5b6675";
  return el("defs", undefined, [
    el("pattern", { id: "hatch", width: 5, height: 5, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, [rect(0, 0, 5, 5, { fill: th.grey }), line(0, 0, 0, 5, { stroke: hatchLine, "stroke-width": 1.1 })]),
    el("radialGradient", { id: "gglow", cx: "50%", cy: "50%", r: "50%" }, [el("stop", { offset: "0%", "stop-color": th.accent, "stop-opacity": 0.55 }), el("stop", { offset: "100%", "stop-color": th.accent, "stop-opacity": 0 })]),
  ]);
}

/** Fine millimetre grid across the sheet. */
export function sheetGrid(th: Theme, w: number, h: number): string {
  const minor = th.mode === "paper" ? "#14171c" : "#e8ecf2";
  const out: string[] = [];
  for (let x = 0; x <= w; x += 20) out.push(line(x, 0, x, h, { stroke: minor, "stroke-width": x % 100 === 0 ? 1 : 0.6, opacity: x % 100 === 0 ? 0.075 : 0.035 }));
  for (let y = 0; y <= h; y += 20) out.push(line(0, y, w, y, { stroke: minor, "stroke-width": y % 100 === 0 ? 1 : 0.6, opacity: y % 100 === 0 ? 0.075 : 0.035 }));
  return g(out);
}

/** Crosshair registration marks set into the four corners. */
export function registration(th: Theme, w: number, h: number, inset = 30): string {
  const mark = (cx: number, cy: number) =>
    g([line(cx - 15, cy, cx + 15, cy, { stroke: th.ink, "stroke-width": 1.4 }), line(cx, cy - 15, cx, cy + 15, { stroke: th.ink, "stroke-width": 1.4 }), circle(cx, cy, 8, { fill: "none", stroke: th.ink, "stroke-width": 1.4 })], { opacity: 0.55 });
  return g([mark(inset, inset), mark(w - inset, inset), mark(inset, h - inset), mark(w - inset, h - inset)]);
}

function arrow(x: number, y: number, dir: "l" | "r" | "u" | "d", color: string): string {
  const s = 9;
  const k = 3.2;
  const pts: Record<string, [number, number][]> = {
    l: [[x, y], [x + s, y - k], [x + s, y + k]],
    r: [[x, y], [x - s, y - k], [x - s, y + k]],
    u: [[x, y], [x - k, y + s], [x + k, y + s]],
    d: [[x, y], [x - k, y - s], [x + k, y - s]],
  };
  return polygon(pts[dir] as [number, number][], { fill: color });
}

export function bubble(th: Theme, cx: number, cy: number, label: string, r = 17): string {
  return g([
    circle(cx, cy, r, { fill: th.bg, stroke: th.accent, "stroke-width": 2.2 }),
    text(cx, cy + 6, label, { "text-anchor": "middle", "font-family": MONO, "font-size": 17, "font-weight": 700, fill: th.ink }),
  ]);
}

/** Horizontal dimension line from x0 to x1 at y, with extension lines up to `from`. A bubble sits at its centre. */
export function dimH(th: Theme, x0: number, x1: number, y: number, from: number, label?: string): string {
  const mid = (x0 + x1) / 2;
  const dir = y > from ? 1 : -1;
  const c = th.dim;
  const parts = [
    line(x0, from + dir * 6, x0, y + dir * 8, { stroke: c, "stroke-width": 1.1 }),
    line(x1, from + dir * 6, x1, y + dir * 8, { stroke: c, "stroke-width": 1.1 }),
    line(x0, y, label ? mid - 24 : x1, y, { stroke: c, "stroke-width": 1.3 }),
    ...(label ? [line(mid + 24, y, x1, y, { stroke: c, "stroke-width": 1.3 })] : []),
    arrow(x0, y, "l", c),
    arrow(x1, y, "r", c),
  ];
  if (label) parts.push(bubble(th, mid, y, label));
  return g(parts);
}

export function dimV(th: Theme, y0: number, y1: number, x: number, from: number, label?: string): string {
  const mid = (y0 + y1) / 2;
  const dir = x > from ? 1 : -1;
  const c = th.dim;
  const parts = [
    line(from + dir * 6, y0, x + dir * 8, y0, { stroke: c, "stroke-width": 1.1 }),
    line(from + dir * 6, y1, x + dir * 8, y1, { stroke: c, "stroke-width": 1.1 }),
    line(x, y0, x, label ? mid - 24 : y1, { stroke: c, "stroke-width": 1.3 }),
    ...(label ? [line(x, mid + 24, x, y1, { stroke: c, "stroke-width": 1.3 })] : []),
    arrow(x, y0, "u", c),
    arrow(x, y1, "d", c),
  ];
  if (label) parts.push(bubble(th, x, mid, label));
  return g(parts);
}

/** Dash-dot centrelines through (cx, cy). */
export function centerlines(th: Theme, cx: number, cy: number, hw: number, hh: number): string {
  const a: Attrs = { stroke: th.accent, "stroke-width": 1.1, "stroke-dasharray": "22 5 3 5", opacity: 0.85 };
  return g([line(cx - hw, cy, cx + hw, cy, a), line(cx, cy - hh, cx, cy + hh, a)]);
}

/** Leader with a bubble: from a point on the part to a bubble placed outside it. */
export function leader(th: Theme, px: number, py: number, bx: number, by: number, label: string): string {
  return g([line(px, py, bx, by, { stroke: th.dim, "stroke-width": 1.2 }), circle(px, py, 3.6, { fill: th.accent }), bubble(th, bx, by, label)]);
}

export interface TitleBlock {
  part: string;
  fig: string;
  scale: string;
  rev: string;
  right?: string;
}

/** Drawing title block along the bottom edge. */
export function titleBlock(th: Theme, w: number, h: number, tb: TitleBlock): string {
  const x = 56;
  const y = h - 106;
  const bw = w - 112;
  const bh = 50;
  const cells = [
    { x: 0, w: 0.5, k: "DWG", v: tb.part },
    { x: 0.5, w: 0.17, k: "FIG.", v: tb.fig },
    { x: 0.67, w: 0.17, k: "SCALE", v: tb.scale },
    { x: 0.84, w: 0.16, k: "REV", v: tb.rev },
  ];
  const out: string[] = [rect(x, y, bw, bh, { fill: th.bg, stroke: th.ink, "stroke-width": 1.4 })];
  for (const c of cells) {
    if (c.x > 0) out.push(line(x + bw * c.x, y, x + bw * c.x, y + bh, { stroke: th.ink, "stroke-width": 1 }));
    out.push(text(x + bw * c.x + 12, y + 17, c.k, { "font-family": MONO, "font-size": 12, fill: th.detail, "letter-spacing": 2 }));
    out.push(text(x + bw * c.x + 12, y + 40, c.v, { "font-family": MONO, "font-size": 20, "font-weight": 700, fill: th.ink, "letter-spacing": 1 }));
  }
  return g(out);
}

export { escapeXml, path };
