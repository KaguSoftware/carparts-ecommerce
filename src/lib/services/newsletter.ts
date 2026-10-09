import "server-only";
import { db } from "@/lib/db";
import { DomainError, notFound } from "@/lib/errors";
import type { Actor, Id, NewsletterSubscriber, Paged, PageParams } from "@/lib/types/domain";
import { emailSchema, localeSchema } from "@/lib/validation/common";
import type { Locale } from "@/i18n/routing";
import { logAudit } from "./audit";
import { toCsv } from "./_csv";
import { includesText, normalizeEmail, nowIso, paginate } from "./_shared";

export async function subscribe(input: { email: string; locale: Locale; source: string }): Promise<{ alreadySubscribed: boolean }> {
  const email = emailSchema.safeParse(input.email);
  const locale = localeSchema.safeParse(input.locale);
  if (!email.success) throw new DomainError("validation_failed", { fieldErrors: { email: [email.error.issues[0]?.message ?? "email_invalid"] } });
  if (!locale.success) throw new DomainError("validation_failed", { fieldErrors: { locale: ["invalid_value"] } });
  const source = (input.source || "unknown").trim().slice(0, 40);
  return db.transaction(async () => {
    const existing = await db.newsletter.findOne((n) => n.email === email.data);
    if (existing && !existing.unsubscribedAt) return { alreadySubscribed: true };
    if (existing) {
      await db.newsletter.update(existing.id, { unsubscribedAt: undefined, subscribedAt: nowIso(), locale: locale.data, source });
      return { alreadySubscribed: false };
    }
    await db.newsletter.insert({ email: email.data, locale: locale.data, source, subscribedAt: nowIso() });
    return { alreadySubscribed: false };
  });
}

export async function unsubscribe(email: string): Promise<void> {
  const e = normalizeEmail(email);
  await db.transaction(async () => {
    const existing = await db.newsletter.findOne((n) => n.email === e);
    if (existing && !existing.unsubscribedAt) await db.newsletter.update(existing.id, { unsubscribedAt: nowIso() });
  });
}

export async function listSubscribers(params: PageParams & { q?: string } = {}): Promise<Paged<NewsletterSubscriber>> {
  const rows = await db.newsletter.find({ where: (n) => (params.q ? includesText([n.email, n.source], params.q) : true), orderBy: [{ field: "subscribedAt", direction: "desc" }] });
  return paginate(rows, params, 50);
}

export async function exportSubscribersCsv(): Promise<string> {
  const rows = await db.newsletter.find({ where: (n) => !n.unsubscribedAt, orderBy: [{ field: "subscribedAt", direction: "desc" }] });
  return toCsv(
    ["email", "locale", "source", "subscribed_at"],
    rows.map((n) => [n.email, n.locale, n.source, n.subscribedAt]),
  );
}

export async function deleteSubscriber(id: Id, actor: Actor): Promise<void> {
  await db.transaction(async () => {
    const row = await db.newsletter.get(id);
    if (!row) throw notFound("subscriber");
    await db.newsletter.delete(id);
    await logAudit({ actor, action: "newsletter.delete", entityType: "subscriber", entityId: id, summary: "Deleted a newsletter subscriber" });
  });
}
