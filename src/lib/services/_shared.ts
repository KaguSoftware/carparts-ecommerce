import "server-only";
import type { Actor, Id, Paged, PageParams } from "@/lib/types/domain";
import { DomainError } from "@/lib/errors";
import { slugify } from "@/lib/utils";

/** Internal helpers shared by services. Not part of the public service contract. */

export const nowIso = (): string => new Date().toISOString();

export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 100;

export function normalizePage(params?: PageParams, defaultSize = DEFAULT_PAGE_SIZE): { page: number; pageSize: number } {
  const page = Math.max(1, Math.floor(Number(params?.page) || 1));
  const rawSize = Math.floor(Number(params?.pageSize) || defaultSize);
  return { page, pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize)) };
}

/** Slice an already filtered+sorted array into a page. */
export function paginate<T>(items: T[], params?: PageParams, defaultSize = DEFAULT_PAGE_SIZE): Paged<T> {
  const { page, pageSize } = normalizePage(params, defaultSize);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize, pageCount };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function actorLabel(actor: Actor): string {
  return actor.email ?? actor.id;
}

export function isoDay(iso: string): string {
  return iso.slice(0, 10);
}

/** Case-insensitive, trimmed containment test used by admin search boxes. */
export function includesText(haystack: Array<string | undefined | null>, needle: string): boolean {
  const n = needle.trim().toLowerCase();
  if (!n) return true;
  return haystack.some((h) => (h ?? "").toLowerCase().includes(n));
}

/**
 * Build the `changes` diff for audit entries. Only the listed fields are compared; values are compared by JSON
 * equality. Large strings are truncated so the audit log stays small.
 */
export function diffFields<T extends object>(before: T, after: T, fields: readonly (keyof T & string)[]): Record<string, { from: unknown; to: unknown }> | undefined {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const f of fields) {
    const a = (before as Record<string, unknown>)[f];
    const b = (after as Record<string, unknown>)[f];
    if (JSON.stringify(a) !== JSON.stringify(b)) out[f] = { from: shrink(a), to: shrink(b) };
  }
  return Object.keys(out).length ? out : undefined;
}

function shrink(value: unknown): unknown {
  if (typeof value === "string" && value.length > 120) return value.slice(0, 117) + "...";
  if (Array.isArray(value) && value.length > 10) return `[${value.length} items]`;
  if (value && typeof value === "object") {
    const s = JSON.stringify(value);
    return s.length > 200 ? s.slice(0, 197) + "..." : value;
  }
  return value;
}

/**
 * Pick a slug: use `desired` verbatim when explicitly given (throws `slug_taken` on collision),
 * otherwise derive from `fallbackText` and append -2, -3 ... until unique.
 */
export function resolveSlug(opts: { desired?: string; fallbackText: string; taken: (slug: string) => boolean; reserved?: string }): string {
  if (opts.desired !== undefined && opts.desired !== "") {
    const slug = slugify(opts.desired);
    if (!slug) throw new DomainError("validation_failed", { fieldErrors: { slug: ["slug_invalid"] } });
    if (slug !== opts.reserved && opts.taken(slug)) throw new DomainError("slug_taken", { status: 409 });
    return slug;
  }
  const base = slugify(opts.fallbackText) || "item";
  let candidate = base;
  let n = 2;
  while (opts.taken(candidate)) candidate = `${base}-${n++}`.slice(0, 96);
  return candidate;
}

export function requireFound<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new DomainError("not_found", { status: 404, params: { what } });
  return value;
}

export function uniqueIds(ids: Id[]): Id[] {
  return [...new Set(ids)];
}

export function groupBy<T, K extends string>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/** `Math.round` to one decimal. */
export const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Constant-time string comparison (tokens). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const { timingSafeEqual } = await import("node:crypto");
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
