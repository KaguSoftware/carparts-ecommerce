import "server-only";
import { siteUrl } from "@/lib/env";
import type { Locale } from "@/i18n/routing";
import type { OutboxEmail } from "@/lib/services/contracts";
import type { Cents, ContactMessage, Id, Order, Paged, PageParams } from "@/lib/types/domain";
import { getMailer } from "./mailer";
import {
  renderAdminContact,
  renderAdminNewOrder,
  renderContactAck,
  renderOrderConfirmation,
  renderPasswordReset,
  renderRefundNotice,
  renderShippingUpdate,
  renderStaffInvite,
  renderVerifyEmail,
  renderWelcome,
  type Rendered,
} from "./templates";

export { getMailer, outboxDir, FileOutboxMailer, type Mailer, type MailMessage } from "./mailer";

/**
 * Email service (ARCHITECTURE.md > EmailService). Every function renders a bilingual template and hands it to
 * the configured mailer (file outbox in development; implement `Mailer` for real delivery).
 */

async function deliver(to: string, locale: Locale, rendered: Rendered): Promise<void> {
  await getMailer().send({ to, locale, subject: rendered.subject, html: rendered.html, text: rendered.text, template: rendered.template });
}

export async function sendOrderConfirmation(order: Order): Promise<void> {
  await deliver(order.email, order.locale, renderOrderConfirmation(order, siteUrl()));
}

export async function sendShippingUpdate(order: Order): Promise<void> {
  await deliver(order.email, order.locale, renderShippingUpdate(order, siteUrl()));
}

export async function sendRefundNotice(order: Order, amount: Cents): Promise<void> {
  await deliver(order.email, order.locale, renderRefundNotice(order, amount, siteUrl()));
}

export async function sendPasswordReset(input: { email: string; name: string; url: string; locale: Locale }): Promise<void> {
  await deliver(input.email, input.locale, renderPasswordReset(input));
}

export async function sendVerifyEmail(input: { email: string; name: string; url: string; locale: Locale }): Promise<void> {
  await deliver(input.email, input.locale, renderVerifyEmail(input));
}

export async function sendStaffInvite(input: { email: string; name: string; url: string; locale: Locale }): Promise<void> {
  await deliver(input.email, input.locale, renderStaffInvite(input));
}

export async function sendContactAck(message: ContactMessage): Promise<void> {
  await deliver(message.email, message.locale, renderContactAck(message));
}

export async function listOutbox(params?: PageParams & { to?: string }): Promise<Paged<OutboxEmail>> {
  return getMailer().list(params);
}

export async function getOutboxEmail(id: Id): Promise<OutboxEmail | null> {
  return getMailer().get(id);
}

/* ---- additions beyond EmailService (see ARCHITECTURE.md > CHANGES) ---- */

export async function sendWelcome(input: { email: string; name: string; locale: Locale }): Promise<void> {
  await deliver(input.email, input.locale, renderWelcome({ ...input, url: `${siteUrl()}/${input.locale}` }));
}

/** Staff copy of a new order (recipient: settings.emails.adminAddress). */
export async function sendAdminNewOrder(order: Order, to: string): Promise<void> {
  await deliver(to, "en", renderAdminNewOrder(order, siteUrl()));
}

/** Staff copy of a contact form message. */
export async function sendContactToStaff(message: ContactMessage, to: string): Promise<void> {
  await deliver(to, "en", renderAdminContact(message, siteUrl()));
}

