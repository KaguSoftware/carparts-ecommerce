import "server-only";
import { brand } from "@/config/brand";
import { localize } from "@/lib/i18n-string";
import { formatMinor, formatMoney } from "@/lib/money";
import type { Locale } from "@/i18n/routing";
import type { AddressInput, ContactMessage, Order } from "@/lib/types/domain";

/**
 * Bilingual transactional email templates (en / tr). Pure functions: data in, { subject, html, text } out.
 * HTML is table-free inline-styled markup that survives common mail clients; every dynamic value is escaped.
 */

export interface Rendered {
  subject: string;
  html: string;
  text: string;
  template: string;
}

const esc = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Only http(s) URLs are allowed in links. */
const safeUrl = (url: string): string => (/^https?:\/\//i.test(url) ? url : "#");

const C = brand.colors;
const MONO = "'JetBrains Mono',Consolas,'Courier New',monospace";

type Dict = Record<string, string>;

const COPY: Record<Locale, Dict> = {
  en: {
    hi: "Hi {name},",
    team: `The ${brand.fullName} team`,
    footer: `${brand.legalEntity} | ${brand.contact.email}`,
    footerNote: "You are receiving this email because of activity on your account or order.",
    // order confirmation
    orderConfirmedSubject: "Order {number} confirmed",
    orderConfirmedTitle: "Thanks for your order",
    orderConfirmedIntro: "We received your payment and are getting your parts ready. Order {number} is now being processed.",
    item: "Item",
    qty: "Qty",
    price: "Price",
    subtotal: "Subtotal",
    discount: "Discount",
    shipping: "Shipping",
    free: "Free",
    tax: "Tax",
    total: "Total",
    charged: "Charged",
    shipTo: "Shipping to",
    method: "Delivery",
    viewOrder: "View your order",
    // shipped
    shippedSubject: "Order {number} has shipped",
    shippedTitle: "Your order is on its way",
    shippedIntro: "Order {number} has left our warehouse.",
    carrier: "Carrier",
    tracking: "Tracking number",
    pickupReady: "Your order is ready for pickup at our Detroit warehouse.",
    // refund
    refundSubject: "Refund issued for order {number}",
    refundTitle: "Your refund is on its way",
    refundIntro: "We refunded {amount} for order {number}. It can take 5-10 business days to appear on your statement.",
    // reset
    resetSubject: "Reset your password",
    resetTitle: "Reset your password",
    resetIntro: "We received a request to reset the password for your account. This link expires in 1 hour.",
    resetCta: "Choose a new password",
    resetIgnore: "If you did not ask for this, you can safely ignore this email.",
    // verify
    verifySubject: "Confirm your email address",
    verifyTitle: "Confirm your email",
    verifyIntro: "Confirm this address to finish setting up your account.",
    verifyCta: "Confirm email",
    // welcome
    welcomeSubject: `Welcome to ${brand.fullName}`,
    welcomeTitle: "Welcome aboard",
    welcomeIntro: "Your account is ready. Add your vehicle to see only the parts that fit, and track every order from your account.",
    welcomeCta: "Start shopping",
    // staff invite
    inviteSubject: `You have been invited to ${brand.fullName}`,
    inviteTitle: "Set up your staff account",
    inviteIntro: "An administrator created a staff account for you. Set your password to sign in to the admin panel. The link expires in 3 days.",
    inviteCta: "Set password",
    // contact
    contactSubject: "We received your message",
    contactTitle: "Thanks for getting in touch",
    contactIntro: "Our team will reply within one business day. A copy of your message:",
    adminOrderSubject: "New order {number} ({total})",
    adminContactSubject: "New contact message: {subject}",
  },
  tr: {
    hi: "Merhaba {name},",
    team: `${brand.fullName} ekibi`,
    footer: `${brand.legalEntity} | ${brand.contact.email}`,
    footerNote: "Bu e-postayı hesabınızdaki veya siparişinizdeki bir işlem nedeniyle aldınız.",
    orderConfirmedSubject: "{number} numaralı siparişiniz onaylandı",
    orderConfirmedTitle: "Siparişiniz için teşekkürler",
    orderConfirmedIntro: "Ödemenizi aldık ve parçalarınızı hazırlıyoruz. {number} numaralı sipariş şu anda işleme alındı.",
    item: "Ürün",
    qty: "Adet",
    price: "Fiyat",
    subtotal: "Ara toplam",
    discount: "İndirim",
    shipping: "Kargo",
    free: "Ücretsiz",
    tax: "Vergi",
    total: "Toplam",
    charged: "Tahsil edilen",
    shipTo: "Teslimat adresi",
    method: "Teslimat",
    viewOrder: "Siparişinizi görüntüleyin",
    shippedSubject: "{number} numaralı siparişiniz kargoya verildi",
    shippedTitle: "Siparişiniz yolda",
    shippedIntro: "{number} numaralı sipariş depomuzdan çıktı.",
    carrier: "Kargo firması",
    tracking: "Takip numarası",
    pickupReady: "Siparişiniz Detroit deposunda teslim almanız için hazır.",
    refundSubject: "{number} numaralı sipariş için iade yapıldı",
    refundTitle: "İadeniz yolda",
    refundIntro: "{number} numaralı sipariş için {amount} iade ettik. Hesap özetinize yansıması 5-10 iş günü sürebilir.",
    resetSubject: "Şifrenizi sıfırlayın",
    resetTitle: "Şifrenizi sıfırlayın",
    resetIntro: "Hesabınızın şifresini sıfırlamak için bir talep aldık. Bu bağlantı 1 saat geçerlidir.",
    resetCta: "Yeni şifre belirle",
    resetIgnore: "Bu talebi siz yapmadıysanız bu e-postayı güvenle yok sayabilirsiniz.",
    verifySubject: "E-posta adresinizi doğrulayın",
    verifyTitle: "E-postanızı doğrulayın",
    verifyIntro: "Hesabınızı tamamlamak için bu adresi doğrulayın.",
    verifyCta: "E-postayı doğrula",
    welcomeSubject: `${brand.fullName} ailesine hoş geldiniz`,
    welcomeTitle: "Aramıza hoş geldiniz",
    welcomeIntro: "Hesabınız hazır. Aracınızı ekleyerek yalnızca uyumlu parçaları görün ve tüm siparişlerinizi hesabınızdan takip edin.",
    welcomeCta: "Alışverişe başla",
    inviteSubject: `${brand.fullName} ekibine davet edildiniz`,
    inviteTitle: "Personel hesabınızı oluşturun",
    inviteIntro: "Bir yönetici sizin için personel hesabı oluşturdu. Yönetim paneline giriş yapmak için şifrenizi belirleyin. Bağlantı 3 gün geçerlidir.",
    inviteCta: "Şifre belirle",
    contactSubject: "Mesajınızı aldık",
    contactTitle: "Bize ulaştığınız için teşekkürler",
    contactIntro: "Ekibimiz bir iş günü içinde yanıt verecek. Mesajınızın bir kopyası:",
    adminOrderSubject: "Yeni sipariş {number} ({total})",
    adminContactSubject: "Yeni iletişim mesajı: {subject}",
  },
};

function t(locale: Locale, key: string, vars: Record<string, string | number> = {}): string {
  const template = COPY[locale][key] ?? COPY.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ""));
}

interface LayoutInput {
  locale: Locale;
  title: string;
  /** Pre-escaped HTML body. */
  body: string;
  cta?: { label: string; url: string };
  textBody: string;
  preheader?: string;
}

function layout(input: LayoutInput): { html: string; text: string } {
  const { locale, title, body, cta } = input;
  const button = cta
    ? `<p style="margin:28px 0"><a href="${esc(safeUrl(cta.url))}" style="display:inline-block;background:${C.orange};color:${C.graphite};font-weight:700;text-decoration:none;padding:13px 26px;border-radius:2px;font-family:Arial,Helvetica,sans-serif">${esc(cta.label)}</a></p>
<p style="margin:0;color:#5b6470;font-size:12px;word-break:break-all">${esc(cta.url)}</p>`
    : "";
  const html = `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;background:${C.paper};font-family:Arial,Helvetica,sans-serif;color:${C.graphite}">
<span style="display:none;max-height:0;overflow:hidden">${esc(input.preheader ?? title)}</span>
<div style="max-width:600px;margin:0 auto;padding:24px 16px">
  <div style="border:1px solid ${C.graphite}">
  <div style="background:${C.graphite};padding:20px 24px;border-bottom:4px solid ${C.orange}">
    <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:0.12em">${esc(brand.name)}</span>
    <span style="color:${C.amber};font-size:11px;letter-spacing:0.3em;margin-left:8px">${esc(brand.descriptor)}</span>
  </div>
  <div style="background:#ffffff;padding:32px 24px;line-height:1.55;font-size:15px">
    <h1 style="margin:0 0 16px;font-size:22px;text-transform:uppercase;letter-spacing:0.02em">${esc(title)}</h1>
    ${body}
    ${button}
    <p style="margin:32px 0 0">${esc(t(locale, "team"))}</p>
  </div>
  <div style="border-top:1px solid ${C.graphite};background:${C.paper};padding:10px 24px;font-family:${MONO};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#4b5461">DWG ${esc(brand.name)} &nbsp;|&nbsp; ${esc(title)} &nbsp;|&nbsp; REV ${new Date().getUTCFullYear()}</div>
  </div>
  <p style="color:#5b6470;font-size:12px;text-align:center;margin:16px 0 0">${esc(t(locale, "footer"))}<br>${esc(t(locale, "footerNote"))}</p>
</div></body></html>`;
  const text = `${title}\n\n${input.textBody}${cta ? `\n\n${cta.label}: ${cta.url}` : ""}\n\n${t(locale, "team")}\n${t(locale, "footer")}\n`;
  return { html, text };
}

const para = (s: string) => `<p style="margin:0 0 14px">${esc(s)}</p>`;

function formatAddress(a: AddressInput): string[] {
  return [`${a.firstName} ${a.lastName}`, a.company, a.line1, a.line2, `${a.postalCode} ${a.city}${a.region ? `, ${a.region}` : ""}`, a.country].filter((x): x is string => Boolean(x));
}

function orderMoney(order: Order) {
  return (usd: number) => formatMoney(usd, order.locale, { currency: order.currency, rate: order.fxRate });
}

export function orderUrl(siteUrl: string, order: Pick<Order, "number" | "accessToken" | "locale">): string {
  return `${siteUrl}/${order.locale}/checkout/confirmation/${encodeURIComponent(order.number)}?t=${encodeURIComponent(order.accessToken)}`;
}

export function renderOrderConfirmation(order: Order, siteUrl: string): Rendered {
  const locale = order.locale;
  const money = orderMoney(order);
  const name = order.shippingAddress.firstName;
  const th = `style="text-align:left;padding:8px 0;border-bottom:2px solid ${C.graphite};font-size:12px;text-transform:uppercase;letter-spacing:0.06em"`;
  const rows = order.items
    .map(
      (i) => `<tr><td style="padding:10px 0;border-bottom:1px solid #e3e6ea">${esc(localize(i.name, locale))}<br><span style="color:#5b6470;font-size:13px">${esc(localize(i.variantName, locale))} | <span style="font-family:${MONO};letter-spacing:0.04em;text-transform:uppercase;color:${C.graphite}">${esc(i.sku)}</span></span></td>
<td style="padding:10px 8px;border-bottom:1px solid #e3e6ea;text-align:center">${i.quantity}</td>
<td style="padding:10px 0;border-bottom:1px solid #e3e6ea;text-align:right">${esc(money(i.unitPrice * i.quantity))}</td></tr>`,
    )
    .join("");
  const totalRow = (label: string, value: string, strong = false) =>
    `<tr><td colspan="2" style="padding:4px 8px 4px 0;text-align:right;${strong ? "font-weight:700" : ""}">${esc(label)}</td><td style="padding:4px 0;text-align:right;${strong ? "font-weight:700" : ""}">${esc(value)}</td></tr>`;
  const body = `${para(t(locale, "hi", { name }))}${para(t(locale, "orderConfirmedIntro", { number: order.number }))}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:8px 0 16px">
<tr><th ${th}>${esc(t(locale, "item"))}</th><th ${th.replace("left", "center")}>${esc(t(locale, "qty"))}</th><th ${th.replace("left", "right")}>${esc(t(locale, "price"))}</th></tr>
${rows}
${totalRow(t(locale, "subtotal"), money(order.subtotal))}
${order.discount > 0 ? totalRow(`${t(locale, "discount")}${order.couponCode ? ` (${order.couponCode})` : ""}`, `-${money(order.discount)}`) : ""}
${totalRow(t(locale, "shipping"), order.shipping === 0 ? t(locale, "free") : money(order.shipping))}
${order.tax > 0 ? totalRow(t(locale, "tax"), money(order.tax)) : ""}
${totalRow(t(locale, "total"), formatMinor(order.chargedTotal, order.currency, locale), true)}
</table>
<p style="margin:0 0 4px;font-weight:700">${esc(t(locale, "shipTo"))}</p>
<p style="margin:0 0 14px">${formatAddress(order.shippingAddress).map(esc).join("<br>")}</p>
<p style="margin:0 0 4px;font-weight:700">${esc(t(locale, "method"))}</p>
<p style="margin:0">${esc(localize(order.shippingMethod.name, locale))}</p>`;
  const lines = order.items.map((i) => `- ${localize(i.name, locale)} (${i.sku}) x${i.quantity}  ${money(i.unitPrice * i.quantity)}`).join("\n");
  const textBody = `${t(locale, "hi", { name })}\n\n${t(locale, "orderConfirmedIntro", { number: order.number })}\n\n${lines}\n\n${t(locale, "total")}: ${formatMinor(order.chargedTotal, order.currency, locale)}\n\n${t(locale, "shipTo")}:\n${formatAddress(order.shippingAddress).join("\n")}`;
  const cta = { label: t(locale, "viewOrder"), url: orderUrl(siteUrl, order) };
  const out = layout({ locale, title: t(locale, "orderConfirmedTitle"), body, cta, textBody });
  return { subject: t(locale, "orderConfirmedSubject", { number: order.number }), ...out, template: "order_confirmation" };
}

export function renderShippingUpdate(order: Order, siteUrl: string): Rendered {
  const locale = order.locale;
  const name = order.shippingAddress.firstName;
  const isPickup = order.shippingMethod.code === "pickup";
  const details = isPickup
    ? para(t(locale, "pickupReady"))
    : `<p style="margin:0 0 14px"><strong>${esc(t(locale, "carrier"))}:</strong> ${esc(order.carrier ?? "-")}<br><strong>${esc(t(locale, "tracking"))}:</strong> ${esc(order.trackingNumber ?? "-")}</p>`;
  const body = `${para(t(locale, "hi", { name }))}${para(t(locale, "shippedIntro", { number: order.number }))}${details}`;
  const textBody = `${t(locale, "hi", { name })}\n\n${t(locale, "shippedIntro", { number: order.number })}\n\n${isPickup ? t(locale, "pickupReady") : `${t(locale, "carrier")}: ${order.carrier ?? "-"}\n${t(locale, "tracking")}: ${order.trackingNumber ?? "-"}`}`;
  const out = layout({ locale, title: t(locale, "shippedTitle"), body, cta: { label: t(locale, "viewOrder"), url: orderUrl(siteUrl, order) }, textBody });
  return { subject: t(locale, "shippedSubject", { number: order.number }), ...out, template: "shipping_update" };
}

export function renderRefundNotice(order: Order, amountUsd: number, siteUrl: string): Rendered {
  const locale = order.locale;
  const amount = orderMoney(order)(amountUsd);
  const name = order.shippingAddress.firstName;
  const intro = t(locale, "refundIntro", { amount, number: order.number });
  const body = `${para(t(locale, "hi", { name }))}${para(intro)}`;
  const out = layout({ locale, title: t(locale, "refundTitle"), body, cta: { label: t(locale, "viewOrder"), url: orderUrl(siteUrl, order) }, textBody: `${t(locale, "hi", { name })}\n\n${intro}` });
  return { subject: t(locale, "refundSubject", { number: order.number }), ...out, template: "refund_notice" };
}

function linkMail(
  template: string,
  locale: Locale,
  name: string,
  url: string,
  keys: { subject: string; title: string; intro: string; cta: string; extra?: string },
): Rendered {
  const intro = t(locale, keys.intro);
  const extra = keys.extra ? t(locale, keys.extra) : "";
  const body = `${para(t(locale, "hi", { name }))}${para(intro)}${extra ? para(extra) : ""}`;
  const out = layout({ locale, title: t(locale, keys.title), body, cta: { label: t(locale, keys.cta), url }, textBody: `${t(locale, "hi", { name })}\n\n${intro}${extra ? `\n\n${extra}` : ""}` });
  return { subject: t(locale, keys.subject), ...out, template };
}

export const renderPasswordReset = (i: { name: string; url: string; locale: Locale }) =>
  linkMail("password_reset", i.locale, i.name, i.url, { subject: "resetSubject", title: "resetTitle", intro: "resetIntro", cta: "resetCta", extra: "resetIgnore" });

export const renderVerifyEmail = (i: { name: string; url: string; locale: Locale }) =>
  linkMail("verify_email", i.locale, i.name, i.url, { subject: "verifySubject", title: "verifyTitle", intro: "verifyIntro", cta: "verifyCta" });

export const renderStaffInvite = (i: { name: string; url: string; locale: Locale }) =>
  linkMail("staff_invite", i.locale, i.name, i.url, { subject: "inviteSubject", title: "inviteTitle", intro: "inviteIntro", cta: "inviteCta" });

export const renderWelcome = (i: { name: string; url: string; locale: Locale }) =>
  linkMail("welcome", i.locale, i.name, i.url, { subject: "welcomeSubject", title: "welcomeTitle", intro: "welcomeIntro", cta: "welcomeCta" });

export function renderContactAck(message: ContactMessage): Rendered {
  const locale = message.locale;
  const body = `${para(t(locale, "hi", { name: message.name }))}${para(t(locale, "contactIntro"))}<blockquote style="margin:0 0 14px;padding:12px 16px;background:${C.paper};white-space:pre-wrap">${esc(message.subject)}\n\n${esc(message.message)}</blockquote>`;
  const out = layout({ locale, title: t(locale, "contactTitle"), body, textBody: `${t(locale, "hi", { name: message.name })}\n\n${t(locale, "contactIntro")}\n\n${message.subject}\n\n${message.message}` });
  return { subject: t(locale, "contactSubject"), ...out, template: "contact_ack" };
}

/** Internal notification for staff (always English). */
export function renderAdminNewOrder(order: Order, siteUrl: string): Rendered {
  const total = formatMinor(order.chargedTotal, order.currency, "en");
  const lines = order.items.map((i) => `- ${i.name.en} (${i.sku}) x${i.quantity}`).join("\n");
  const url = `${siteUrl}/admin/orders/${order.id}`;
  const body = `${para(`Order ${order.number} was placed by ${order.email}.`)}<pre style="margin:0 0 14px;font-family:inherit;white-space:pre-wrap">${esc(lines)}</pre>${para(`Total charged: ${total}`)}`;
  const out = layout({ locale: "en", title: `New order ${order.number}`, body, cta: { label: "Open in admin", url }, textBody: `Order ${order.number} by ${order.email}\n\n${lines}\n\nTotal charged: ${total}` });
  return { subject: t("en", "adminOrderSubject", { number: order.number, total }), ...out, template: "admin_new_order" };
}

export function renderAdminContact(message: ContactMessage, siteUrl: string): Rendered {
  const url = `${siteUrl}/admin/messages`;
  const body = `${para(`From ${message.name} <${message.email}>${message.orderNumber ? ` about order ${message.orderNumber}` : ""}`)}<blockquote style="margin:0 0 14px;padding:12px 16px;background:${C.paper};white-space:pre-wrap">${esc(message.message)}</blockquote>`;
  const out = layout({ locale: "en", title: message.subject, body, cta: { label: "Open inbox", url }, textBody: `From ${message.name} <${message.email}>\n\n${message.message}` });
  return { subject: t("en", "adminContactSubject", { subject: message.subject }), ...out, template: "admin_contact" };
}
