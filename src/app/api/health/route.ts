import { db } from "@/lib/db";
import { json } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/health -> { status, time, version } (503 when the data store cannot be read). */
export async function GET() {
  const time = new Date().toISOString();
  const version = process.env.npm_package_version ?? "0.1.0";
  try {
    await db.settings.count();
    return json({ status: "ok", time, version });
  } catch {
    return json({ status: "degraded", time, version }, { status: 503 });
  }
}
