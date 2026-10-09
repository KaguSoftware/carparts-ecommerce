import { z } from "zod";
import { assertStaff, toActor } from "@/lib/auth/session";
import { csvResponse, handle, searchParamsObject, validate } from "@/lib/api/respond";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { logAudit } from "@/lib/services/audit";
import { exportOrdersCsv } from "@/lib/services/orders";

export const dynamic = "force-dynamic";

const date = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "date_invalid");
const querySchema = z.object({
  q: z.string().max(120).optional(),
  status: z.enum(["all", "pending_payment", "processing", "shipped", "delivered", "cancelled", "refunded"]).optional(),
  paymentStatus: z.enum(["all", "unpaid", "paid", "failed", "partially_refunded", "refunded"]).optional(),
  from: date.optional(),
  to: date.optional(),
  sort: z.enum(["created_desc", "created_asc", "total_desc", "total_asc"]).optional(),
});

/** GET /api/admin/export/orders?status=&paymentStatus=&from=&to=&q= -> CSV (staff with orders.read; audited). */
export const GET = handle(async (request: Request) => {
  const staff = await assertStaff("orders.read");
  await enforceRateLimit("export", { limit: 20, windowMs: 10 * 60_000, discriminator: staff.id });
  const filter = validate(querySchema, searchParamsObject(new URL(request.url)));
  const csv = await exportOrdersCsv(filter);
  await logAudit({ actor: toActor(staff), action: "export.orders", entityType: "export", entityId: "orders", summary: `Exported orders CSV (${csv.trim().split("\r\n").length - 1} rows)` });
  return csvResponse(csv, `orders-${new Date().toISOString().slice(0, 10)}.csv`);
});
