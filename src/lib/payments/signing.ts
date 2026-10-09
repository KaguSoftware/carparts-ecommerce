import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/** HMAC helpers for 3-D-Secure style action tokens and mock webhooks. */

function secret(): string {
  return env.PAYMENT_WEBHOOK_SECRET;
}

export function safeCompare(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Deterministic per payment, so a replayed `placeOrder` can hand the same challenge back. */
export function createActionToken(providerRef: string): string {
  return createHmac("sha256", secret()).update(`action:${providerRef}`).digest("base64url");
}

export function verifyActionToken(providerRef: string, token: string): boolean {
  return typeof token === "string" && token.length > 0 && safeCompare(createActionToken(providerRef), token);
}

export function shortHash(input: string, length = 20): string {
  return createHash("sha256").update(input).digest("hex").slice(0, length);
}

/** Header value `t=<unix seconds>,v1=<hex hmac of "t.body">` (the same scheme Stripe uses). */
export function signWebhookPayload(rawBody: string, key: string = secret(), now: Date = new Date()): string {
  const t = Math.floor(now.getTime() / 1000);
  const v1 = createHmac("sha256", key).update(`${t}.${rawBody}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

export function verifySignedPayload(rawBody: string, header: string | null, key: string, toleranceSeconds = 300, now: Date = new Date()): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=") as [string, string]));
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isFinite(t) || !v1) return false;
  if (Math.abs(Math.floor(now.getTime() / 1000) - t) > toleranceSeconds) return false;
  const expected = createHmac("sha256", key).update(`${t}.${rawBody}`).digest("hex");
  return safeCompare(expected, v1);
}
