import { z } from "zod";
import { getVehicleSelection } from "@/lib/session/cookies";
import { handle, json, searchParamsObject, validate } from "@/lib/api/respond";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { suggest } from "@/lib/services/search";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().max(120).default(""),
  locale: z.enum(["en", "tr"]).default("en"),
  limit: z.coerce.number().int().min(1).max(8).default(8),
});

/** GET /api/search/suggest?q=&locale=&limit= -> SearchSuggestions (vehicle-aware through the `vehicle` cookie). */
export const GET = handle(async (request: Request) => {
  await enforceRateLimit("suggest", { limit: 120, windowMs: 60_000 });
  const { q, locale, limit } = validate(querySchema, searchParamsObject(new URL(request.url)));
  const vehicle = await getVehicleSelection();
  return json(await suggest(q, { locale, vehicle, limit }));
});
