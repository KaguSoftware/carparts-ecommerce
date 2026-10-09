/**
 * APEXLINE logo geometry. Everything is drawn as strokes/paths so the wordmark renders identically
 * everywhere (inline SVG, standalone .svg files, OG images) without depending on a webfont.
 *
 * Wordmark: custom monoline condensed capitals, 20 units tall, stroke 3.4, clipped to the cap line
 * and baseline so diagonal terminals (A, X, N) cut flat like machined stock. The "I" is the signal
 * orange "line" in APEX-LINE.
 *
 * Mark: a gauge/gear ring of 36 teeth, a horizon line, and an apex chevron (an "A" without a bar).
 */

export const WORDMARK_STROKE = 3.4;
export const WORDMARK_HEIGHT = 20;
const GAP = 3;

interface LetterDef {
  char: string;
  /** advance width (without gap) */
  w: number;
  /** stroke path data in the letter's local coordinates (x from 0) */
  d: string;
  accent?: boolean;
}

const LETTERS: LetterDef[] = [
  { char: "A", w: 14, d: "M1 22 L7 4.6 L13 22 M4 14.2 H10" },
  { char: "P", w: 12.5, d: "M1.7 0 V20 M0 1.7 H7.6 Q10.8 1.7 10.8 5.1 V6.6 Q10.8 10 7.6 10 H1.7" },
  { char: "E", w: 10.5, d: "M1.7 0 V20 M0 1.7 H10.5 M0 10 H9.2 M0 18.3 H10.5" },
  { char: "X", w: 14, d: "M1.2 -2 L12.8 22 M12.8 -2 L1.2 22" },
  { char: "L", w: 10.5, d: "M1.7 0 V20 M0 18.3 H10.5" },
  { char: "I", w: WORDMARK_STROKE, d: "M1.7 0 V20", accent: true },
  { char: "N", w: 13, d: "M1.7 0 V20 M11.3 0 V20 M1.7 -1 L11.3 21" },
  { char: "E", w: 10.5, d: "M1.7 0 V20 M0 1.7 H10.5 M0 10 H9.2 M0 18.3 H10.5" },
];

export interface PlacedLetter {
  char: string;
  x: number;
  d: string;
  accent: boolean;
}

function layout(): { letters: PlacedLetter[]; width: number } {
  let x = 0;
  const letters: PlacedLetter[] = [];
  for (const l of LETTERS) {
    letters.push({ char: l.char, x, d: l.d, accent: !!l.accent });
    x += l.w + GAP;
  }
  return { letters, width: x - GAP };
}

const placed = layout();
export const WORDMARK_LETTERS: PlacedLetter[] = placed.letters;
export const WORDMARK_WIDTH: number = placed.width;

/** Mark geometry in a 64x64 box. */
export const MARK = {
  size: 64,
  center: 32,
  ringRadius: 27.5,
  ringStroke: 5,
  /** circumference / teeth, split into dash + gap */
  teeth: 36,
  innerRadius: 23.5,
  chevron: "M32 12 L47 47 H38.6 L32 30.6 L25.4 47 H17 Z",
  horizon: { x: 9.5, y: 40.4, w: 45, h: 3 },
} as const;

export function ringDash(teeth: number): { dash: string; offset: number } {
  const circumference = 2 * Math.PI * MARK.ringRadius;
  const seg = circumference / teeth;
  const dash = seg * 0.58;
  // start the first tooth centred on 12 o'clock (circles start at 3 o'clock, rotated -90deg in markup)
  return { dash: `${dash.toFixed(3)} ${(seg - dash).toFixed(3)}`, offset: dash / 2 };
}

export const BRAND_COLORS = {
  graphite: "#14171c",
  paper: "#f4f5f7",
  orange: "#ff5a1f",
} as const;
