import { z } from "zod";
import { assertSameOrigin, handle, json, readJson } from "@/lib/api/respond";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { submitMessage } from "@/lib/services/contact";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().max(200),
  email: z.string().max(254),
  phone: z.string().max(40).optional(),
  subject: z.string().max(300),
  message: z.string().max(10_000),
  orderNumber: z.string().max(40).optional(),
  locale: z.enum(["en", "tr"]).default("en"),
});

/** POST -> { id } of the stored message. Validation details are enforced by the service. */
export const POST = handle(async (request: Request) => {
  assertSameOrigin(request);
  await enforceRateLimit("contact", { limit: 5, windowMs: 15 * 60_000 });
  const body = await readJson(request, schema, { maxBytes: 32 * 1024 });
  const message = await submitMessage(body);
  return json({ id: message.id }, { status: 201 });
});
