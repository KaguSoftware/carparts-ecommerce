import { z } from "zod";
import { handle, json, searchParamsObject, validate } from "@/lib/api/respond";
import { listEngines } from "@/lib/services/vehicles";

const PUBLIC = "public, s-maxage=300, stale-while-revalidate=600";

/** GET /api/vehicles/engines?modelId=&year= -> exact vehicle configurations (ids to store in the selection) */
export const GET = handle(async (request: Request) => {
  const { modelId, year } = validate(
    z.object({ modelId: z.string().min(1).max(64), year: z.coerce.number().int().min(1950).max(2100) }),
    searchParamsObject(new URL(request.url)),
  );
  return json({ engines: await listEngines(modelId, year) }, { cacheControl: PUBLIC });
});
