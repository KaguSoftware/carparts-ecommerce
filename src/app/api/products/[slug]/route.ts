import { z } from "zod";
import { handle, json, problem, searchParamsObject, validate } from "@/lib/api/respond";
import { DomainError } from "@/lib/errors";
import { getProductBySlug } from "@/lib/services/catalog";

const querySchema = z.object({
  makeId: z.string().max(64).optional(),
  modelId: z.string().max(64).optional(),
  year: z.coerce.number().int().min(1950).max(2100).optional(),
  vehicleId: z.string().max(64).optional(),
});

/** GET /api/products/{slug}[?vehicleId=] -> ProductDetail (variants carry no cost prices). */
export const GET = handle(async (request: Request, context: { params: Promise<{ slug: string }> }) => {
  const { slug } = await context.params;
  const vehicle = validate(querySchema, searchParamsObject(new URL(request.url)));
  const detail = await getProductBySlug(slug.slice(0, 120), { vehicle });
  if (!detail) return problem(new DomainError("not_found", { status: 404, params: { what: "product" } }));
  return json(detail, { cacheControl: "public, s-maxage=30, stale-while-revalidate=120" });
});
