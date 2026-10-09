import "../helpers/test-env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { createHmac } from "node:crypto";
import { detectBrand, digitsOnly, luhnValid, validateCard } from "@/lib/payments/card";
import { MockPaymentProvider } from "@/lib/payments/mock";
import { StripePaymentProvider } from "@/lib/payments/stripe";
import { createActionToken, signWebhookPayload, verifyActionToken, verifySignedPayload } from "@/lib/payments/signing";
import { getPaymentProvider } from "@/lib/payments";
import { checkRateLimit, rateLimit, resetRateLimits } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/ip";
import { csvCell, parseCsv, parseCsvRecords, toCsv, CsvParseError } from "@/lib/services/_csv";
import { signCartId, verifyCartCookie, parseVehicleSelection } from "@/lib/session/cookies";
import { can, permissionsFor } from "@/lib/permissions";
import { FileOutboxMailer, getMailer, outboxDir } from "@/lib/email/mailer";
import { renderContactAck, renderOrderConfirmation, renderPasswordReset, renderRefundNotice, renderShippingUpdate, renderStaffInvite, renderVerifyEmail, renderWelcome, renderAdminNewOrder } from "@/lib/email/templates";
import type { ContactMessage, Order } from "@/lib/types/domain";

const FUTURE = new Date().getUTCFullYear() + 3;
const card = (number: string, over: Partial<{ expMonth: number; expYear: number; cvc: string; holder: string }> = {}) => ({ number, expMonth: 12, expYear: FUTURE, cvc: "123", holder: "Test Shopper", ...over });
const charge = (provider: MockPaymentProvider, number: string, key = Math.random().toString(36)) =>
  provider.charge({ amount: 5000, currency: "USD", payment: { type: "card", card: card(number) }, idempotencyKey: key, metadata: { orderNumber: "AX-1", email: "a@example.com" } });

describe("card helpers", () => {
  it("validates Luhn, detects brands and normalises spacing", () => {
    expect(luhnValid("4242424242424242")).toBe(true);
    expect(luhnValid("4242424242424241")).toBe(false);
    expect(luhnValid("123")).toBe(false);
    expect(luhnValid("4242 4242 4242 4242")).toBe(false); // callers strip spaces first
    expect(digitsOnly("4242 4242-4242 4242")).toBe("4242424242424242");
    expect(detectBrand("4242424242424242")).toBe("visa");
    expect(detectBrand("5555555555554444")).toBe("mastercard");
    expect(detectBrand("2223003122003222")).toBe("mastercard");
    expect(detectBrand("378282246310005")).toBe("amex");
    expect(detectBrand("6011111111111117")).toBe("discover");
    expect(detectBrand("9999999999999995")).toBe("card");
  });

  it("reports field errors as validation codes", () => {
    expect(validateCard(card("4242 4242 4242 4242"))).toEqual({});
    expect(validateCard(card("4242 4242 4242 4241")).number).toEqual(["card_number_invalid"]);
    expect(validateCard(card("4242 4242 4242 4242", { cvc: "12" })).cvc).toEqual(["card_cvc_invalid"]);
    expect(validateCard(card("4242 4242 4242 4242", { cvc: "12a" })).cvc).toEqual(["card_cvc_invalid"]);
    expect(validateCard(card("378282246310005", { cvc: "123" })).cvc).toEqual(["card_cvc_invalid"]); // amex needs 4
    expect(validateCard(card("378282246310005", { cvc: "1234" }))).toEqual({});
    expect(validateCard(card("4242 4242 4242 4242", { expMonth: 13 })).expiry).toEqual(["card_expiry_invalid"]);
    expect(validateCard(card("4242 4242 4242 4242", { expYear: 2020 })).expiry).toEqual(["card_expiry_invalid"]);
    expect(validateCard(card("4242 4242 4242 4242", { holder: " " })).holder).toEqual(["required"]);
    const now = new Date("2026-06-15T00:00:00Z");
    expect(validateCard(card("4242 4242 4242 4242", { expMonth: 6, expYear: 2026 }), now)).toEqual({}); // current month is still valid
    expect(validateCard(card("4242 4242 4242 4242", { expMonth: 5, expYear: 2026 }), now).expiry).toBeTruthy();
    expect(validateCard(card("4242 4242 4242 4242", { expMonth: 12, expYear: 28 }), now)).toEqual({}); // two-digit year
  });
});

describe("mock payment provider", () => {
  const provider = new MockPaymentProvider();

  it("implements the documented test cards", async () => {
    expect(await charge(provider, "4242 4242 4242 4242")).toMatchObject({ status: "succeeded", method: { brand: "visa", last4: "4242" } });
    expect(await charge(provider, "5555 5555 5555 4444")).toMatchObject({ status: "succeeded", method: { brand: "mastercard", last4: "4444" } });
    expect(await charge(provider, "4000 0000 0000 0002")).toMatchObject({ status: "failed", code: "card_declined" });
    expect(await charge(provider, "4000 0000 0000 9995")).toMatchObject({ status: "failed", code: "insufficient_funds" });
    expect(await charge(provider, "4000 0000 0000 0069")).toMatchObject({ status: "failed", code: "expired_card" });
    expect(await charge(provider, "4000 0000 0000 0119")).toMatchObject({ status: "failed", code: "processing_error" });
    for (const number of ["4000 0025 0000 3155", "4000 0000 0000 3220"]) {
      const r = await charge(provider, number);
      expect(r.status).toBe("requires_action");
    }
    expect(await charge(provider, "4242 4242 4242 4241")).toMatchObject({ status: "failed", code: "processing_error" }); // not Luhn-valid
  });

  it("never echoes card numbers or CVC back", async () => {
    const r = await charge(provider, "4242 4242 4242 4242");
    const json = JSON.stringify(r);
    expect(json).not.toContain("4242424242424242");
    expect(json).not.toContain("123");
  });

  it("is idempotent per key and rejects bad amounts", async () => {
    const a = await charge(provider, "4242 4242 4242 4242", "same-key");
    const b = await charge(provider, "4000 0000 0000 0002", "same-key"); // replay wins, no second charge
    expect(b).toEqual(a);
    const other = await charge(provider, "4242 4242 4242 4242", "other-key");
    expect((other as { providerRef: string }).providerRef).not.toBe((a as { providerRef: string }).providerRef);
    expect(await provider.charge({ amount: 0, currency: "USD", payment: { type: "card", card: card("4242424242424242") }, idempotencyKey: "zero", metadata: { orderNumber: "x", email: "x" } })).toMatchObject({ status: "failed" });
    expect(await provider.charge({ amount: 10.5, currency: "USD", payment: { type: "card", card: card("4242424242424242") }, idempotencyKey: "frac", metadata: { orderNumber: "x", email: "x" } })).toMatchObject({ status: "failed" });
  });

  it("supports test tokens", async () => {
    const meta = { orderNumber: "x", email: "x" };
    expect(await provider.charge({ amount: 100, currency: "TRY", payment: { type: "token", token: "tok_visa" }, idempotencyKey: "t1", metadata: meta })).toMatchObject({ status: "succeeded" });
    expect(await provider.charge({ amount: 100, currency: "USD", payment: { type: "token", token: "tok_chargeDeclined" }, idempotencyKey: "t2", metadata: meta })).toMatchObject({ status: "failed", code: "card_declined" });
    expect(await provider.charge({ amount: 100, currency: "USD", payment: { type: "token", token: "tok_threeDSecure" }, idempotencyKey: "t3", metadata: meta })).toMatchObject({ status: "requires_action" });
    expect(await provider.charge({ amount: 100, currency: "USD", payment: { type: "token", token: "tok_unknown" }, idempotencyKey: "t4", metadata: meta })).toMatchObject({ status: "failed" });
  });

  it("confirms 3-D-Secure style actions only with the matching token and approval", async () => {
    const r = await charge(provider, "4000 0025 0000 3155");
    if (r.status !== "requires_action") throw new Error("expected requires_action");
    expect(await provider.confirmAction({ providerRef: r.providerRef, actionToken: r.actionToken, approved: true })).toEqual({ status: "succeeded", providerRef: r.providerRef });
    expect(await provider.confirmAction({ providerRef: r.providerRef, actionToken: r.actionToken, approved: false })).toEqual({ status: "failed", code: "authentication_failed" });
    expect(await provider.confirmAction({ providerRef: r.providerRef, actionToken: "forged", approved: true })).toEqual({ status: "failed", code: "authentication_failed" });
    expect(await provider.confirmAction({ providerRef: "mock_pi_other", actionToken: r.actionToken, approved: true })).toEqual({ status: "failed", code: "authentication_failed" });
    expect(verifyActionToken(r.providerRef, r.actionToken)).toBe(true);
    expect(verifyActionToken(r.providerRef, createActionToken("mock_pi_x"))).toBe(false);
  });

  it("refunds idempotently-keyed amounts and rejects invalid ones", async () => {
    const r = await charge(provider, "4242 4242 4242 4242");
    if (r.status !== "succeeded") throw new Error("expected success");
    const refund = await provider.refund({ providerRef: r.providerRef, amount: 2500, currency: "USD", reason: "test", idempotencyKey: "r1" });
    expect(refund).toMatchObject({ status: "succeeded" });
    expect(await provider.refund({ providerRef: r.providerRef, amount: 2500, currency: "USD", reason: "test", idempotencyKey: "r1" })).toEqual(refund);
    expect(await provider.refund({ providerRef: r.providerRef, amount: 0, currency: "USD", reason: "x", idempotencyKey: "r2" })).toMatchObject({ status: "failed" });
    expect(await provider.refund({ providerRef: "pi_unknown", amount: 100, currency: "USD", reason: "x", idempotencyKey: "r3" })).toMatchObject({ status: "failed", code: "unknown_payment" });
  });

  it("verifies webhook signatures, tolerance and tampering", () => {
    const body = JSON.stringify({ type: "payment.succeeded", providerRef: "mock_pi_abc" });
    const header = signWebhookPayload(body);
    expect(provider.verifyWebhook(body, header)).toEqual({ valid: true, event: { type: "payment.succeeded", providerRef: "mock_pi_abc" } });
    expect(provider.verifyWebhook(body + " ", header)).toEqual({ valid: false });
    expect(provider.verifyWebhook(body, null)).toEqual({ valid: false });
    expect(provider.verifyWebhook(body, "garbage")).toEqual({ valid: false });
    expect(provider.verifyWebhook(body, signWebhookPayload(body, "wrong-secret-wrong-secret"))).toEqual({ valid: false });
    const old = signWebhookPayload(body, process.env.PAYMENT_WEBHOOK_SECRET, new Date(Date.now() - 10 * 60_000));
    expect(provider.verifyWebhook(body, old)).toEqual({ valid: false }); // replay outside the 5 minute window
    const unknownType = JSON.stringify({ type: "something.else", providerRef: "x" });
    expect(provider.verifyWebhook(unknownType, signWebhookPayload(unknownType))).toEqual({ valid: false });
    const failed = JSON.stringify({ type: "payment.failed", providerRef: "mock_pi_abc", code: "card_declined" });
    expect(provider.verifyWebhook(failed, signWebhookPayload(failed))).toEqual({ valid: true, event: { type: "payment.failed", providerRef: "mock_pi_abc", code: "card_declined" } });
    expect(verifySignedPayload("x", "t=1,v1=00", "k")).toBe(false);
  });

  it("selects the provider from the environment; the Stripe slot verifies signatures but does not move money", async () => {
    expect(getPaymentProvider().id).toBe("mock");
    const stripe = new StripePaymentProvider();
    await expect(stripe.charge()).rejects.toMatchObject({ code: "payment_failed" });
    await expect(stripe.refund()).rejects.toMatchObject({ code: "payment_failed" });
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret_123456";
    vi.resetModules();
    const { StripePaymentProvider: Fresh } = await import("@/lib/payments/stripe");
    const body = JSON.stringify({ type: "payment_intent.succeeded", data: { object: { id: "pi_123" } } });
    const t = Math.floor(Date.now() / 1000);
    const sig = `t=${t},v1=${createHmac("sha256", "whsec_test_secret_123456").update(`${t}.${body}`).digest("hex")}`;
    expect(new Fresh().verifyWebhook(body, sig)).toEqual({ valid: true, event: { type: "payment.succeeded", providerRef: "pi_123" } });
    expect(new Fresh().verifyWebhook(body, "t=1,v1=bad")).toEqual({ valid: false });
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });
});

describe("rate limiting", () => {
  beforeEach(() => resetRateLimits());

  it("allows `limit` hits per sliding window and reports the wait", () => {
    const opts = { key: "contact:1.2.3.4", limit: 3, windowMs: 60_000 };
    const t0 = 1_000_000;
    expect(checkRateLimit(opts, t0)).toMatchObject({ allowed: true, remaining: 2 });
    expect(checkRateLimit(opts, t0 + 1000)).toMatchObject({ allowed: true, remaining: 1 });
    expect(checkRateLimit(opts, t0 + 2000)).toMatchObject({ allowed: true, remaining: 0 });
    const blocked = checkRateLimit(opts, t0 + 3000);
    expect(blocked).toMatchObject({ allowed: false, remaining: 0 });
    expect(blocked.retryAfterMs).toBe(57_000);
    expect(checkRateLimit(opts, t0 + 60_001)).toMatchObject({ allowed: true }); // first hit slid out
    expect(checkRateLimit({ ...opts, key: "contact:other-ip" }, t0 + 3000).allowed).toBe(true); // buckets are independent
  });

  it("rateLimit() throws a 429 DomainError with retryAfter", () => {
    const opts = { key: "x", limit: 1, windowMs: 10_000 };
    rateLimit(opts);
    expect(() => rateLimit(opts)).toThrowError(expect.objectContaining({ code: "rate_limited", status: 429 }));
    try {
      rateLimit(opts);
    } catch (e) {
      expect((e as { params: { retryAfter: number } }).params.retryAfter).toBeGreaterThan(0);
    }
  });
});

describe("client ip", () => {
  const h = (entries: Record<string, string>) => new Headers(entries);
  afterEach(() => {
    vi.resetModules();
  });

  it("ignores forwarding headers unless TRUST_PROXY=true", async () => {
    // untrusted: forwarded headers are ignored and callers are bucketed by a header fingerprint
    const a = getClientIp(h({ "x-forwarded-for": "9.9.9.9", "user-agent": "agent-a" }));
    expect(a).toMatch(/^fp-[0-9a-f]{16}$/);
    expect(getClientIp(h({ "x-forwarded-for": "1.2.3.4", "user-agent": "agent-a" }))).toBe(a);
    expect(getClientIp(h({ "x-forwarded-for": "9.9.9.9", "user-agent": "agent-b" }))).not.toBe(a);
    process.env.TRUST_PROXY = "true";
    vi.resetModules();
    const { getClientIp: trusted } = await import("@/lib/security/ip");
    expect(trusted(h({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
    expect(trusted(h({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
    expect(trusted(h({}))).toMatch(/^fp-/);
    delete process.env.TRUST_PROXY;
  });
});

describe("csv", () => {
  it("round-trips quotes, commas, newlines and unicode", () => {
    const rows = [["a", 'he said "hi"', "x,y", "line1\nline2", "İstanbul ş"]];
    const text = toCsv(["c1", "c2", "c3", "c4", "c5"], rows);
    expect(parseCsv(text)).toEqual([["c1", "c2", "c3", "c4", "c5"], rows[0]]);
  });

  it("parses BOM, CRLF, empty fields and trailing newlines", () => {
    expect(parseCsv("﻿a,b\r\n1,\r\n\r\n,2")).toEqual([["a", "b"], ["1", ""], ["", "2"]]);
    expect(parseCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("")).toEqual([]);
  });

  it("rejects malformed files", () => {
    expect(() => parseCsv('a,b\n"unterminated,2')).toThrow(CsvParseError);
    expect(() => parseCsv("a\n1\n2\n3", 2)).toThrow(CsvParseError);
    expect(() => parseCsvRecords("")).toThrow(CsvParseError);
  });

  it("neutralises spreadsheet formulas on export and restores them on import", () => {
    for (const evil of ["=1+1", "+cmd", "-2+3", "@SUM(A1)", "\tTAB"]) expect(csvCell(evil)).toBe(`'${evil}`);
    expect(csvCell(-5, { numeric: true })).toBe("-5");
    expect(csvCell("-5")).toBe("'-5");
    expect(csvCell(null)).toBe("");
    const text = toCsv(["name"], [["=HYPERLINK(\"x\")"]]);
    expect(parseCsvRecords(text).records[0]!.name).toBe('=HYPERLINK("x")');
    expect(parseCsvRecords("Name,SKU\n a , b ").records[0]).toEqual({ name: "a", sku: "b" }); // headers lower-cased, cells trimmed
  });
});

describe("signed cookies and selections", () => {
  it("accepts only cart ids signed with our secret", () => {
    const signed = signCartId("crt_abc123");
    expect(verifyCartCookie(signed)).toBe("crt_abc123");
    expect(verifyCartCookie("crt_abc123.forgedsignature000000000000")).toBeNull();
    expect(verifyCartCookie(signed.replace("crt_abc123", "crt_other"))).toBeNull();
    expect(verifyCartCookie("crt_abc123")).toBeNull();
    expect(verifyCartCookie("")).toBeNull();
    expect(verifyCartCookie(undefined)).toBeNull();
  });

  it("parses vehicle cookies defensively", () => {
    expect(parseVehicleSelection('{"makeId":"mak_bmw","modelId":"mdl_x","year":2019}')).toEqual({ makeId: "mak_bmw", modelId: "mdl_x", year: 2019 });
    expect(parseVehicleSelection('{"vehicleId":"veh_1"}')).toEqual({ vehicleId: "veh_1" });
    expect(parseVehicleSelection("not json")).toEqual({});
    expect(parseVehicleSelection('{"year":"2019"}')).toEqual({});
    expect(parseVehicleSelection('{"makeId":"a","evil":"<script>"}')).toEqual({});
    expect(parseVehicleSelection(undefined)).toEqual({});
  });
});

describe("roles and permissions", () => {
  it("matches the documented matrix", () => {
    for (const p of ["dashboard.read", "catalog.read", "orders.read", "customers.read", "catalog.write", "inventory.write", "orders.write", "reviews.moderate", "marketing.write", "cms.write"] as const) {
      expect(can("staff", p), p).toBe(true);
      expect(can("admin", p), p).toBe(true);
      expect(can("customer", p), p).toBe(false);
    }
    for (const p of ["orders.refund", "settings.write", "users.manage", "audit.read"] as const) {
      expect(can("staff", p), p).toBe(false);
      expect(can("admin", p), p).toBe(true);
      expect(can("customer", p), p).toBe(false);
    }
    expect(permissionsFor("customer")).toEqual([]);
    expect(permissionsFor("admin").length).toBe(14);
  });
});

describe("email", () => {
  const order = {
    id: "ord_1",
    number: "AX-100001",
    email: "buyer@example.com",
    locale: "en",
    status: "processing",
    paymentStatus: "paid",
    items: [{ id: "oit_1", productId: "prd_1", variantId: "var_1", sku: "SKU-1", name: { en: "Brake <b>Pad</b> Set", tr: "Fren Balata Seti" }, variantName: { en: "Front", tr: "Ön" }, brandName: "APX", quantity: 2, unitPrice: 4999, discount: 0, tax: 600, lineTotal: 9998, refundedQuantity: 0 }],
    shippingAddress: { firstName: "Ann<script>", lastName: "Lee", line1: "1 Test Rd", city: "Austin", region: "TX", postalCode: "78701", country: "US", phone: "1" },
    billingAddress: { firstName: "Ann", lastName: "Lee", line1: "1 Test Rd", city: "Austin", region: "TX", postalCode: "78701", country: "US", phone: "1" },
    shippingMethod: { id: "shp_standard", code: "standard", name: { en: "Standard Ground", tr: "Standart" }, price: 799, estimatedDaysMin: 3, estimatedDaysMax: 6 },
    couponCode: "SAVE25",
    subtotal: 9998,
    discount: 2500,
    shipping: 799,
    tax: 600,
    total: 8897,
    currency: "USD",
    fxRate: 1,
    chargedTotal: 8897,
    refundedTotal: 0,
    accessToken: "tok<en>&",
    carrier: "UPS",
    trackingNumber: "1Z999",
    events: [],
    internalNotes: [],
  } as unknown as Order;

  it("renders the order confirmation in English with escaped data and a tracking link", () => {
    const mail = renderOrderConfirmation(order, "https://shop.example");
    expect(mail.subject).toBe("Order AX-100001 confirmed");
    expect(mail.template).toBe("order_confirmation");
    expect(mail.html).toContain("Brake &lt;b&gt;Pad&lt;/b&gt; Set");
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("$99.98");
    expect(mail.html).toContain("/en/checkout/confirmation/AX-100001?t=tok%3Cen%3E%26");
    expect(mail.text).toContain("Total: $88.97");
    expect(mail.html).toContain('lang="en"');
  });

  it("renders Turkish copy and TRY amounts for Turkish orders", () => {
    const tr = { ...order, locale: "tr", currency: "TRY", fxRate: 45, chargedTotal: 400365 } as Order;
    const mail = renderOrderConfirmation(tr, "https://shop.example");
    expect(mail.subject).toBe("AX-100001 numaralı siparişiniz onaylandı");
    expect(mail.html).toContain("Fren Balata Seti");
    expect(mail.html).toContain("Siparişiniz için teşekkürler");
    expect(mail.html).toMatch(/4\.003,65/);
    expect(mail.html).toContain('lang="tr"');
    expect(renderShippingUpdate(tr, "https://s.example").subject).toBe("AX-100001 numaralı siparişiniz kargoya verildi");
  });

  it("renders the remaining templates in both languages", () => {
    const link = { name: "Ann", url: "https://shop.example/reset?x=1&y=2", locale: "en" as const };
    for (const locale of ["en", "tr"] as const) {
      const l = { ...link, locale };
      for (const mail of [renderPasswordReset(l), renderVerifyEmail(l), renderStaffInvite(l), renderWelcome(l)]) {
        expect(mail.subject.length).toBeGreaterThan(5);
        expect(mail.html).toContain("&amp;y=2"); // URL is escaped in the markup
        expect(mail.text).toContain("https://shop.example/reset?x=1&y=2");
        expect(mail.html).toContain(`lang="${locale}"`);
      }
    }
    expect(renderPasswordReset({ ...link, locale: "tr" }).subject).toBe("Şifrenizi sıfırlayın");
    expect(renderPasswordReset({ ...link, url: "javascript:alert(1)" }).html).not.toContain('href="javascript:');
    expect(renderShippingUpdate(order, "https://s.example").html).toContain("1Z999");
    expect(renderShippingUpdate({ ...order, shippingMethod: { ...order.shippingMethod, code: "pickup" } } as Order, "https://s.example").html).toContain("ready for pickup");
    expect(renderRefundNotice(order, 1500, "https://s.example").subject).toBe("Refund issued for order AX-100001");
    expect(renderRefundNotice(order, 1500, "https://s.example").html).toContain("$15.00");
    expect(renderAdminNewOrder(order, "https://s.example").html).toContain("/admin/orders/ord_1");
    const msg = { id: "msg_1", name: "Ann", email: "a@example.com", subject: "Hi <3", message: "Where is my <order>?", locale: "tr", status: "new" } as ContactMessage;
    const ack = renderContactAck(msg);
    expect(ack.subject).toBe("Mesajınızı aldık");
    expect(ack.html).toContain("Where is my &lt;order&gt;?");
  });

  it("writes to the file outbox, lists newest first, and refuses path traversal", async () => {
    fs.rmSync(outboxDir(), { recursive: true, force: true });
    const mailer = new FileOutboxMailer();
    const a = await mailer.send({ to: "a@example.com", subject: "one", html: "<p>1</p>", text: "1", template: "t", locale: "en" });
    await new Promise((r) => setTimeout(r, 5));
    const b = await mailer.send({ to: "b@example.com", subject: "two", html: "<p>2</p>", text: "2", template: "t", locale: "tr" });
    const list = await mailer.list();
    expect(list.items.map((e) => e.id)).toEqual([b.id, a.id]);
    expect((await mailer.list({ to: "A@example" })).items.map((e) => e.id)).toEqual([a.id]);
    expect((await mailer.list({ pageSize: 1, page: 2 })).items.map((e) => e.id)).toEqual([a.id]);
    expect(await mailer.get(a.id)).toMatchObject({ subject: "one", to: "a@example.com" });
    expect(await mailer.get("../../etc/passwd")).toBeNull();
    expect(await mailer.get("eml_nope000000")).toBeNull();
    fs.writeFileSync(`${outboxDir()}/broken.json`, "{not json");
    expect((await mailer.list()).total).toBe(2); // corrupt files are skipped, not fatal
    expect(getMailer()).toBeInstanceOf(FileOutboxMailer);
  });
});
