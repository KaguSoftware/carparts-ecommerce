import { handle, json } from "@/lib/api/respond";
import { listMakes } from "@/lib/services/vehicles";

const PUBLIC = "public, s-maxage=300, stale-while-revalidate=600";

/** GET /api/vehicles/makes */
export const GET = handle(async () => json({ makes: await listMakes() }, { cacheControl: PUBLIC }));
