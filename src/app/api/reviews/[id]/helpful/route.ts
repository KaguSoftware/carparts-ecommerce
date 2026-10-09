import { createHash } from "node:crypto";
import { getSessionUser } from "@/lib/auth/session";
import { assertSameOrigin, handle, json } from "@/lib/api/respond";
import { currentClientIp } from "@/lib/security/ip";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { markHelpful } from "@/lib/services/reviews";

export const dynamic = "force-dynamic";

/** POST /api/reviews/{id}/helpful -> { helpfulCount }. One vote per account (or per ip+browser for guests). */
export const POST = handle(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const { id } = await context.params;
  const ip = await currentClientIp();
  await enforceRateLimit("review-helpful", { limit: 30, windowMs: 60_000, ip });
  const user = await getSessionUser();
  const voterKey = user ? `u:${user.id}` : `g:${createHash("sha256").update(`${ip}|${request.headers.get("user-agent") ?? ""}`).digest("hex").slice(0, 24)}`;
  return json(await markHelpful(id.slice(0, 64), voterKey));
});
