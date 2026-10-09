import "server-only";
import { createHash } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Client IP from request headers. `X-Forwarded-For` / `X-Real-IP` are only honoured when `TRUST_PROXY=true`
 * (the app sits behind a reverse proxy that overwrites them); otherwise they are attacker controlled and
 * callers are bucketed by a header fingerprint rather than one shared constant.
 */
export function getClientIp(headers: Pick<Headers, "get">): string {
  if (env.TRUST_PROXY) {
    const forwarded = headers.get("x-forwarded-for");
    if (forwarded) {
      const first = forwarded.split(",")[0]?.trim();
      if (first) return first.slice(0, 64);
    }
    const real = headers.get("x-real-ip")?.trim();
    if (real) return real.slice(0, 64);
  }
  // Untrusted: no reliable IP. Use a coarse header fingerprint instead of one constant, so a single
  // client cannot exhaust a budget shared by every visitor (production must set TRUST_PROXY explicitly).
  const raw = ["user-agent", "accept-language", "accept-encoding"].map((h) => headers.get(h) ?? "").join("|");
  return `fp-${createHash("sha256").update(raw).digest("hex").slice(0, 16)}`;
}

/** Client IP of the current request (Server Actions, route handlers, server components). */
export async function currentClientIp(): Promise<string> {
  const { headers } = await import("next/headers");
  return getClientIp(await headers());
}
