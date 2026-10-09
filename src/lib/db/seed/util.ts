/**
 * Deterministic helpers for building seed data. Everything here is pure (no I/O) so the same code can run
 * in the app (first boot), in scripts (`seed:reset`, art generation) and in tests.
 */
import type { LocalizedString } from "@/lib/i18n-string";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** FNV-1a 32-bit hash. Stable across platforms. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Small deterministic PRNG (mulberry32) with convenience helpers. */
export class Rng {
  private state: number;
  constructor(seed: number | string) {
    this.state = (typeof seed === "string" ? hashString(seed) : seed) >>> 0;
  }
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)] as T;
  }
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  }
  /** Weighted sampling without replacement. */
  sampleWeighted<T>(items: readonly T[], weight: (item: T) => number, count: number): T[] {
    const pool = items.map((item) => ({ item, w: Math.max(0.0001, weight(item)) }));
    const out: T[] = [];
    while (out.length < count && pool.length > 0) {
      const total = pool.reduce((s, p) => s + p.w, 0);
      let r = this.next() * total;
      let idx = 0;
      for (; idx < pool.length - 1; idx++) {
        r -= (pool[idx] as { w: number }).w;
        if (r <= 0) break;
      }
      out.push((pool.splice(idx, 1)[0] as { item: T }).item);
    }
    return out;
  }
}

export const pad = (n: number, width: number) => String(n).padStart(width, "0");

/** Turkish number formatting inside a value: "17.5 mm" -> "17,5 mm" (only decimal points between digits). */
export function trNum(value: string): string {
  return value.replace(/(\d)\.(\d)/g, "$1,$2");
}

export const L = (en: string, tr: string): LocalizedString => ({ en, tr });

/** Spec value that is identical in both languages except for decimal separators. */
export const Lnum = (value: string): LocalizedString => ({ en: value, tr: trNum(value) });

/** Retail price ending: x.99 (never below 0.99). */
export function ending99(cents: number): number {
  return Math.max(99, Math.round(cents / 100) * 100 - 1);
}

/** EAN-13 with a valid check digit derived from a seed string. */
export function ean13(seed: string): string {
  const rng = new Rng(seed);
  const digits = ["5", "9", "0"]; // invented GS1-style prefix block
  while (digits.length < 12) digits.push(String(rng.int(0, 9)));
  const sum = digits.reduce((s, d, i) => s + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  digits.push(String((10 - (sum % 10)) % 10));
  return digits.join("");
}

export function iso(ms: number): string {
  return new Date(ms).toISOString();
}

/** Seed clock: everything is expressed relative to one "now" so the data always looks recent. */
export interface SeedClock {
  now: number;
  ago(ms: number): string;
  ahead(ms: number): string;
}

export function makeClock(now: Date = new Date()): SeedClock {
  const base = Math.floor(now.getTime() / HOUR) * HOUR; // stable within the hour
  return { now: base, ago: (ms) => iso(base - ms), ahead: (ms) => iso(base + ms) };
}

export const SYSTEM_ACTOR = { id: "system", role: "system" } as const;
