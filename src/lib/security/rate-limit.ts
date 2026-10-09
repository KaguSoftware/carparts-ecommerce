import "server-only";
import { DomainError } from "@/lib/errors";
import { currentClientIp } from "./ip";

/**
 * In-memory sliding-window rate limiter (single process, like the JSON store).
 * Swap the `store` for Redis when scaling out; the call sites stay the same.
 */
export interface RateLimitOptions {
  /** Bucket key. Convention: `<route>:<ip>[:<email>]`. */
  key: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Milliseconds until the oldest hit leaves the window (0 when allowed). */
  retryAfterMs: number;
}

const STORE_KEY = Symbol.for("apexline.rateLimit.store");
type Store = { hits: Map<string, number[]>; lastSweep: number };
type G = typeof globalThis & { [STORE_KEY]?: Store };

function store(): Store {
  const g = globalThis as G;
  return (g[STORE_KEY] ??= { hits: new Map(), lastSweep: Date.now() });
}

const MAX_KEYS = 50_000;

function sweep(s: Store, now: number, windowMs: number) {
  if (now - s.lastSweep < 60_000 && s.hits.size < MAX_KEYS) return;
  s.lastSweep = now;
  for (const [key, list] of s.hits) {
    if (list.length === 0 || (list[list.length - 1] as number) < now - Math.max(windowMs, 3_600_000)) s.hits.delete(key);
  }
  // Flood: evict the oldest-touched keys (Map keeps insertion order; touched keys are re-inserted) instead of wiping every counter.
  let excess = s.hits.size - Math.floor(MAX_KEYS * 0.9);
  if (excess > 0) {
    for (const key of s.hits.keys()) {
      if (excess-- <= 0) break;
      s.hits.delete(key);
    }
  }
}

/** Counts a hit and reports whether it is within the limit. Never throws. */
export function checkRateLimit({ key, limit, windowMs }: RateLimitOptions, now = Date.now()): RateLimitResult {
  const s = store();
  sweep(s, now, windowMs);
  const cutoff = now - windowMs;
  const list = (s.hits.get(key) ?? []).filter((t) => t > cutoff);
  if (list.length >= limit) {
    s.hits.delete(key);
    s.hits.set(key, list);
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, (list[0] as number) + windowMs - now) };
  }
  list.push(now);
  s.hits.delete(key);
  s.hits.set(key, list);
  return { allowed: true, remaining: limit - list.length, retryAfterMs: 0 };
}

/** Counts a hit and throws `DomainError("rate_limited")` (HTTP 429) when over the limit. */
export function rateLimit(options: RateLimitOptions): RateLimitResult {
  const result = checkRateLimit(options);
  if (!result.allowed) {
    throw new DomainError("rate_limited", { status: 429, params: { retryAfter: Math.ceil(result.retryAfterMs / 1000) } });
  }
  return result;
}

/**
 * Convenience for actions/route handlers: key = `<name>:<ip>[:<discriminator>]`.
 *   await enforceRateLimit("contact", { limit: 5, windowMs: 10 * 60_000 });
 */
export async function enforceRateLimit(
  name: string,
  opts: { limit: number; windowMs: number; discriminator?: string; ip?: string },
): Promise<RateLimitResult> {
  const ip = opts.ip ?? (await currentClientIp());
  const key = `${name}:${ip}${opts.discriminator ? `:${opts.discriminator.toLowerCase().slice(0, 120)}` : ""}`;
  return rateLimit({ key, limit: opts.limit, windowMs: opts.windowMs });
}

/** Test helper. */
export function resetRateLimits(): void {
  store().hits.clear();
}
