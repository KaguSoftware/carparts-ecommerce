import { z } from "zod";
import { assertSameOrigin, handle, json, readJson } from "@/lib/api/respond";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { subscribe } from "@/lib/services/newsletter";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().trim().max(254),
  locale: z.enum(["en", "tr"]).default("en"),
  source: z.string().trim().max(40).default("footer"),
});

/** POST { email, locale?, source? } -> { alreadySubscribed } */
export const POST = handle(async (request: Request) => {
  assertSameOrigin(request);
  await enforceRateLimit("newsletter", { limit: 5, windowMs: 10 * 60_000 });
  const body = await readJson(request, schema);
  return json(await subscribe(body), { status: 200 });
});
