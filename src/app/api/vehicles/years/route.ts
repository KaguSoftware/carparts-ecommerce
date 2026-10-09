import { z } from "zod";
import { handle, json, searchParamsObject, validate } from "@/lib/api/respond";
import { listYears } from "@/lib/services/vehicles";

const PUBLIC = "public, s-maxage=300, stale-while-revalidate=600";

/** GET /api/vehicles/years?modelId= -> newest first */
export const GET = handle(async (request: Request) => {
  const { modelId } = validate(z.object({ modelId: z.string().min(1).max(64) }), searchParamsObject(new URL(request.url)));
  return json({ years: await listYears(modelId) }, { cacheControl: PUBLIC });
});
