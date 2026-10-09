import { assertStaff, toActor } from "@/lib/auth/session";
import { csvResponse, handle } from "@/lib/api/respond";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { logAudit } from "@/lib/services/audit";
import { exportProductsCsv } from "@/lib/services/catalog";

export const dynamic = "force-dynamic";

/** GET /api/admin/export/products -> CSV, one row per variant (round-trips through the import endpoint). Cost prices included, so staff only. */
export const GET = handle(async () => {
  const staff = await assertStaff("catalog.read");
  await enforceRateLimit("export", { limit: 20, windowMs: 10 * 60_000, discriminator: staff.id });
  const csv = await exportProductsCsv();
  await logAudit({ actor: toActor(staff), action: "export.products", entityType: "export", entityId: "products", summary: `Exported products CSV (${csv.trim().split("\r\n").length - 1} rows)` });
  return csvResponse(csv, `products-${new Date().toISOString().slice(0, 10)}.csv`);
});
