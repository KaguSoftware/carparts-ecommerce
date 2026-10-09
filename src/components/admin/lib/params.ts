/** Helpers for list pages driven by `searchParams` (filters, sort and pagination all live in the URL). */
export type SearchParams = Record<string, string | string[] | undefined>;

export function param(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : undefined;
}

export function intParam(sp: SearchParams, key: string, fallback: number, min = 1, max = 10_000): number {
  const n = Number(param(sp, key));
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

export function enumParam<T extends string>(sp: SearchParams, key: string, allowed: readonly T[], fallback: T): T {
  const v = param(sp, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** `/admin/x?...` with `patch` merged over the current params (null/undefined/"" removes a key). */
export function hrefWith(base: string, current: SearchParams, patch: Record<string, string | number | null | undefined> = {}): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (s) out.set(k, s);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined || v === "") out.delete(k);
    else out.set(k, String(v));
  }
  const qs = out.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Date input (YYYY-MM-DD) -> ISO boundary for filters. */
export function dayStartIso(value: string | undefined): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : undefined;
}
export function dayEndIso(value: string | undefined): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : undefined;
}
