import { z } from "zod";
import { handle, json, searchParamsObject, validate } from "@/lib/api/respond";
import { listProducts } from "@/lib/services/catalog";
import { searchProducts } from "@/lib/services/search";

const bool = z.enum(["1", "true", "0", "false"]).transform((v) => v === "1" || v === "true");
const csv = z
  .string()
  .max(500)
  .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 30));

const querySchema = z.object({
  q: z.string().max(120).optional(),
  category: z.string().max(96).optional(),
  brand: csv.optional(),
  minPrice: z.coerce.number().int().min(0).max(100_000_000).optional(),
  maxPrice: z.coerce.number().int().min(0).max(100_000_000).optional(),
  inStock: bool.optional(),
  onSale: bool.optional(),
  featured: bool.optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  makeId: z.string().max(64).optional(),
  modelId: z.string().max(64).optional(),
  year: z.coerce.number().int().min(1950).max(2100).optional(),
  vehicleId: z.string().max(64).optional(),
  sort: z.enum(["featured", "newest", "price_asc", "price_desc", "rating", "bestselling", "name_asc"]).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
  locale: z.enum(["en", "tr"]).default("en"),
});

/**
 * GET /api/products?q=&category=&brand=a,b&minPrice=&maxPrice=(cents)&inStock=1&onSale=1&sort=&page=&pageSize=&locale=
 *   &makeId=&modelId=&year=&vehicleId=
 * Same semantics as ProductQuery. Cookie independent (the vehicle comes from query params only), so it is cacheable.
 */
export const GET = handle(async (request: Request) => {
  const p = validate(querySchema, searchParamsObject(new URL(request.url)));
  const vehicle = p.makeId || p.modelId || p.year || p.vehicleId ? { makeId: p.makeId, modelId: p.modelId, year: p.year, vehicleId: p.vehicleId } : undefined;
  const query = {
    categorySlug: p.category,
    brandSlugs: p.brand,
    minPrice: p.minPrice,
    maxPrice: p.maxPrice,
    inStockOnly: p.inStock,
    onSale: p.onSale,
    featured: p.featured,
    minRating: p.minRating,
    vehicle,
    sort: p.sort,
    page: p.page,
    pageSize: p.pageSize,
    locale: p.locale,
  };
  const result = p.q ? await searchProducts({ ...query, q: p.q }) : await listProducts(query);
  return json(result, { cacheControl: "public, s-maxage=30, stale-while-revalidate=120" });
});
