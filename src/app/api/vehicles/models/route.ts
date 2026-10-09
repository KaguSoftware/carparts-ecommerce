import { z } from "zod";
import { handle, json, searchParamsObject, validate } from "@/lib/api/respond";
import { listModels } from "@/lib/services/vehicles";

const PUBLIC = "public, s-maxage=300, stale-while-revalidate=600";

/** GET /api/vehicles/models?makeId= */
export const GET = handle(async (request: Request) => {
  const { makeId } = validate(z.object({ makeId: z.string().min(1).max(64) }), searchParamsObject(new URL(request.url)));
  return json({ models: await listModels(makeId) }, { cacheControl: PUBLIC });
});
