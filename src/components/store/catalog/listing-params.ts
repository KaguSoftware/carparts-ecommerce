import type { ProductSort } from "@/lib/services/contracts";

/**
 * Listing URL <-> state. Pure module (safe in server and client components).
 * Query string: q, sort, page, brand (comma separated slugs), min / max (USD cents), stock=1, sale=1, rating, fit=all.
 */
export type SearchParamsInput = Record<string, string | string[] | undefined>;

export const SORT_OPTIONS: ProductSort[] = ["featured", "bestselling", "newest", "price_asc", "price_desc", "rating", "name_asc"];
export const PAGE_SIZE = 24;

export interface ListingParams {
  q: string;
  sort: ProductSort;
  page: number;
  brands: string[];
  minPrice?: number;
  maxPrice?: number;
  inStock: boolean;
  onSale: boolean;
  minRating?: number;
  /** Ignore the saved vehicle (show every part; fit badges still show). */
  showAll: boolean;
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function intParam(value: string, min: number, max: number): number | undefined {
  if (!/^\d{1,9}$/.test(value)) return undefined;
  const n = Number(value);
  return n >= min && n <= max ? n : undefined;
}

export function parseListingParams(sp: SearchParamsInput): ListingParams {
  const sort = first(sp.sort) as ProductSort;
  const min = intParam(first(sp.min), 0, 100_000_000);
  const max = intParam(first(sp.max), 0, 100_000_000);
  const rating = intParam(first(sp.rating), 1, 5);
  return {
    q: first(sp.q).replace(/\s+/g, " ").trim().slice(0, 120),
    sort: SORT_OPTIONS.includes(sort) ? sort : "featured",
    page: intParam(first(sp.page), 1, 1000) ?? 1,
    brands: first(sp.brand)
      .split(",")
      .map((b) => b.trim().toLowerCase())
      .filter((b) => /^[a-z0-9-]{1,60}$/.test(b))
      .slice(0, 12),
    ...(min !== undefined ? { minPrice: min } : {}),
    ...(max !== undefined ? { maxPrice: max } : {}),
    inStock: first(sp.stock) === "1",
    onSale: first(sp.sale) === "1",
    ...(rating !== undefined ? { minRating: rating } : {}),
    showAll: first(sp.fit) === "all",
  };
}

/** Serialises params, omitting defaults so URLs stay short and canonical. */
export function listingSearchParams(p: Partial<ListingParams>): URLSearchParams {
  const out = new URLSearchParams();
  if (p.q) out.set("q", p.q);
  if (p.sort && p.sort !== "featured") out.set("sort", p.sort);
  if (p.brands?.length) out.set("brand", p.brands.join(","));
  if (p.minPrice !== undefined) out.set("min", String(p.minPrice));
  if (p.maxPrice !== undefined) out.set("max", String(p.maxPrice));
  if (p.inStock) out.set("stock", "1");
  if (p.onSale) out.set("sale", "1");
  if (p.minRating !== undefined) out.set("rating", String(p.minRating));
  if (p.showAll) out.set("fit", "all");
  if (p.page && p.page > 1) out.set("page", String(p.page));
  return out;
}

/** Unprefixed href for `Link` from "@/i18n/navigation". */
export function listingHref(basePath: string, p: Partial<ListingParams>): string {
  const qs = listingSearchParams(p).toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function activeFilterCount(p: ListingParams): number {
  return p.brands.length + Number(p.minPrice !== undefined || p.maxPrice !== undefined) + Number(p.inStock) + Number(p.onSale) + Number(p.minRating !== undefined);
}
