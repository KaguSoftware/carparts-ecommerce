import "server-only";
import { z } from "zod";
import { zodFieldErrors } from "@/lib/action-result";
import { db } from "@/lib/db";
import { sendContactAck, sendContactToStaff } from "@/lib/email";
import { DomainError, notFound } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { Actor, ContactMessage, ContactStatus, Id, Paged, PageParams } from "@/lib/types/domain";
import { emailSchema, localeSchema, phoneSchema } from "@/lib/validation/common";
import { logAudit } from "./audit";
import { includesText, nowIso, paginate } from "./_shared";
import { getSettings } from "./settings";

const messageSchema = z.object({
  name: z.string().trim().min(1, "required").max(80, "too_long"),
  email: emailSchema,
  phone: z.union([phoneSchema, z.literal("")]).optional(),
  subject: z.string().trim().min(2, "required").max(150, "too_long"),
  message: z.string().trim().min(10, "too_short").max(5000, "too_long"),
  orderNumber: z.string().trim().max(30, "too_long").optional(),
  locale: localeSchema,
});

export async function submitMessage(input: { name: string; email: string; phone?: string; subject: string; message: string; orderNumber?: string; locale: "en" | "tr" }): Promise<ContactMessage> {
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("validation_failed", { fieldErrors: zodFieldErrors(parsed.error) });
  const d = parsed.data;
  const at = nowIso();
  const message = await db.contactMessages.insert({
    name: d.name,
    email: d.email,
    ...(d.phone ? { phone: d.phone } : {}),
    subject: d.subject,
    message: d.message,
    ...(d.orderNumber ? { orderNumber: d.orderNumber } : {}),
    locale: d.locale,
    status: "new",
    createdAt: at,
    updatedAt: at,
  });
  // Emails are best effort: the message is already safely stored.
  try {
    await sendContactAck(message);
    const settings = await getSettings();
    const staffAddress = settings.emails.adminAddress || settings.store.email;
    if (staffAddress) await sendContactToStaff(message, staffAddress);
  } catch (error) {
    logger.warn("contact.email_failed", { id: message.id, error });
  }
  return message;
}

export async function listMessages(params: PageParams & { status?: ContactStatus | "all"; q?: string } = {}): Promise<Paged<ContactMessage>> {
  const rows = await db.contactMessages.find({
    where: (m) => (!params.status || params.status === "all" || m.status === params.status) && (!params.q || includesText([m.name, m.email, m.subject, m.message, m.orderNumber], params.q)),
    orderBy: [{ field: "createdAt", direction: "desc" }],
  });
  return paginate(rows, params, 25);
}

export async function getMessage(id: Id): Promise<ContactMessage | null> {
  return db.contactMessages.get(id);
}

export async function updateMessage(id: Id, patch: { status?: ContactStatus; adminNotes?: string }, actor: Actor): Promise<ContactMessage> {
  if (patch.status && !["new", "read", "replied", "archived"].includes(patch.status)) throw new DomainError("validation_failed", { fieldErrors: { status: ["invalid_value"] } });
  if (patch.adminNotes !== undefined && patch.adminNotes.length > 5000) throw new DomainError("validation_failed", { fieldErrors: { adminNotes: ["too_long"] } });
  return db.transaction(async () => {
    const current = await db.contactMessages.get(id);
    if (!current) throw notFound("message");
    const saved = await db.contactMessages.update(id, {
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.adminNotes !== undefined ? { adminNotes: patch.adminNotes } : {}),
      updatedAt: nowIso(),
    });
    await logAudit({
      actor,
      action: "message.update",
      entityType: "message",
      entityId: id,
      summary: `Updated message from ${current.name}`,
      changes: patch.status && patch.status !== current.status ? { status: { from: current.status, to: patch.status } } : undefined,
    });
    return saved;
  });
}

export async function deleteMessage(id: Id, actor: Actor): Promise<void> {
  await db.transaction(async () => {
    const current = await db.contactMessages.get(id);
    if (!current) throw notFound("message");
    await db.contactMessages.delete(id);
    await logAudit({ actor, action: "message.delete", entityType: "message", entityId: id, summary: `Deleted message from ${current.name}` });
  });
}
