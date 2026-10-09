import { assertStaff, toActor } from "@/lib/auth/session";
import { csvResponse, handle } from "@/lib/api/respond";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { logAudit } from "@/lib/services/audit";
import { exportSubscribersCsv } from "@/lib/services/newsletter";

export const dynamic = "force-dynamic";

/** GET /api/admin/export/subscribers -> CSV of active newsletter subscribers (marketing.write; audited). */
export const GET = handle(async () => {
  const staff = await assertStaff("marketing.write");
  await enforceRateLimit("export", { limit: 20, windowMs: 10 * 60_000, discriminator: staff.id });
  const csv = await exportSubscribersCsv();
  await logAudit({ actor: toActor(staff), action: "export.subscribers", entityType: "export", entityId: "subscribers", summary: `Exported subscribers CSV (${csv.trim().split("\r\n").length - 1} rows)` });
  return csvResponse(csv, `subscribers-${new Date().toISOString().slice(0, 10)}.csv`);
});
