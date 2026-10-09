import type { AuditEntry, ContactMessage, NewsletterSubscriber, Order } from "@/lib/types/domain";
import type { BuiltProduct } from "./catalog/build";
import { SEED_CREDENTIALS } from "./credentials";
import { DAY, HOUR, Rng, SYSTEM_ACTOR, pad, type SeedClock } from "./util";

const staff = { id: SEED_CREDENTIALS.staff.id, email: SEED_CREDENTIALS.staff.email, role: "staff" } as const;
const admin = { id: SEED_CREDENTIALS.admin.id, email: SEED_CREDENTIALS.admin.email, role: "admin" } as const;

export function buildNewsletter(clock: SeedClock): NewsletterSubscriber[] {
  const rows: [string, "en" | "tr", string, number, number?][] = [
    ["deniz.k@mail.example", "en", "account", 130],
    ["sofia.marino@mail.example", "en", "checkout", 118],
    ["liam.oconnor@mail.example", "en", "footer", 105],
    ["aylin.demir@mail.example", "tr", "footer", 90],
    ["carlos.ortega@mail.example", "en", "checkout", 69],
    ["fatih.aydin@mail.example", "tr", "footer", 62],
    ["hannah.wright@mail.example", "en", "footer", 55],
    ["selin.korkmaz@mail.example", "tr", "checkout", 49],
    ["mateo.silva@mail.example", "en", "footer", 41],
    ["olivia.brooks@mail.example", "en", "footer", 33, 12],
    ["emre.tas@mail.example", "tr", "footer", 27],
    ["ben.carter@mail.example", "en", "account", 22],
    ["gizem.polat@mail.example", "tr", "footer", 14, 4],
    ["ryan.mills@mail.example", "en", "footer", 6],
  ];
  return rows.map(([email, locale, source, daysAgo, unsubAgo], i) => ({
    id: `nws_${pad(i + 1, 3)}`,
    email,
    locale,
    source,
    subscribedAt: clock.ago(daysAgo * DAY),
    ...(unsubAgo ? { unsubscribedAt: clock.ago(unsubAgo * DAY) } : {}),
  }));
}

export function buildContactMessages(clock: SeedClock, orders: Order[]): ContactMessage[] {
  const trOrder = orders.filter((o) => o.locale === "tr").at(-1);
  const enOrder = orders.filter((o) => o.locale === "en" && o.status === "delivered").at(-1);
  const at = (days: number) => clock.ago(days * DAY);
  const m = (n: number, d: number, x: Omit<ContactMessage, "id" | "createdAt" | "updatedAt">): ContactMessage => ({
    id: `msg_${pad(n, 3)}`,
    createdAt: at(d),
    updatedAt: at(Math.max(0, d - (x.status === "new" ? 0 : 1))),
    ...x,
  });
  return [
    m(1, 0.6, { name: "Rafael Costa", email: "rafael.costa@mail.example", subject: "Does the Veloxa RotorMax fit a 2017 Golf 2.0 TDI?", message: "Hello, I am looking at the vented discs from Veloxa. The product page says they fit the 2013-2019 Golf TDI, but my car has the 312 mm front brakes. Can you confirm before I order?", locale: "en", status: "new" }),
    m(2, 1.4, { name: "Ece Yalçın", email: "ece.yalcin@mail.example", phone: "+90 532 555 01 77", subject: "Siparişim ne zaman gelir?", message: "Merhaba, siparişimi dün verdim. Kargoya verildiğinde bilgilendirme yapılacak mı? Ayrıca fatura için ek bir bilgi gerekiyor mu?", orderNumber: trOrder?.number, locale: "tr", status: "new" }),
    m(3, 5, { name: "Daniel Price", email: "daniel.price@mail.example", subject: "Wrong part in my box", message: "I ordered the front brake hoses but received the rear pair. Order number below. Could you send the correct set and a return label?", orderNumber: enOrder?.number, locale: "en", status: "read", adminNotes: "Checked with warehouse: SKU mix-up at packing. Replacement dispatched." }),
    m(4, 9, { name: "Harbor Street Garage", email: "orders@harborstreet.example", phone: "+1 313 555 0175", subject: "Trade pricing for our workshop", message: "We run a 4-bay workshop in Detroit and would like to buy brake and filter parts in volume. Do you offer trade accounts or volume discounts?", locale: "en", status: "replied", adminNotes: "Sent trade price list and VIP20 code. Follow up in 30 days." }),
    m(5, 16, { name: "Burcu Özkan", email: "burcu.ozkan@mail.example", subject: "Fatura talebi", message: "Merhaba, kurumsal fatura kesilmesini istiyorum. Vergi numaram ve unvanım ektedir. Siparişimin faturasını yeniden düzenleyebilir misiniz?", locale: "tr", status: "archived", adminNotes: "Fatura yeniden düzenlendi, e-posta ile gönderildi." }),
    m(6, 21, { name: "Kim Alvarez", email: "kim.alvarez@mail.example", subject: "Feedback on the vehicle selector", message: "Love that I can pick my car once and see only parts that fit. It would be great if it also remembered my second car. Thanks for a really clean site.", locale: "en", status: "read" }),
  ];
}

export function buildAudit(clock: SeedClock, built: BuiltProduct[], orders: Order[]): AuditEntry[] {
  const rng = new Rng("audit");
  const featured = built.filter((b) => b.product.isFeatured);
  const p1 = featured[0]!;
  const p2 = featured[3] ?? featured[1]!;
  const deliveredOrder = orders.filter((o) => o.status === "delivered").at(-1);
  const refundedOrder = orders.find((o) => o.status === "refunded");
  const entries: Omit<AuditEntry, "id">[] = [
    { at: clock.ago(88 * DAY), actor: { ...SYSTEM_ACTOR }, action: "system.seed", entityType: "system", entityId: "seed", summary: "Database seeded with demo catalogue, accounts and sample orders" },
    { at: clock.ago(40 * DAY), actor: admin, action: "settings.update", entityType: "settings", entityId: "settings", summary: "Updated TRY exchange rate", changes: { "currency.tryPerUsd": { from: 43.5, to: 45 } } },
    { at: clock.ago(33 * DAY), actor: staff, action: "product.update", entityType: "product", entityId: p1.product.id, summary: `Changed price of ${p1.product.name.en}`, changes: { price: { from: p1.variants[0]!.price - 300, to: p1.variants[0]!.price } } },
    { at: clock.ago(30 * DAY), actor: admin, action: "coupon.create", entityType: "coupon", entityId: "cpn_vip20", summary: "Created coupon VIP20" },
    { at: clock.ago(26 * DAY), actor: staff, action: "inventory.adjust", entityType: "variant", entityId: p2.variants[0]!.id, summary: `Restocked ${p2.variants[0]!.sku} (+24 units, purchase order PO-2231)`, changes: { stockOnHand: { from: 6, to: 30 } } },
    ...(refundedOrder ? [{ at: refundedOrder.events.at(-1)!.at, actor: admin, action: "order.refund", entityType: "order", entityId: refundedOrder.id, summary: `Refunded ${refundedOrder.number} in full` } as Omit<AuditEntry, "id">] : []),
    { at: clock.ago(18 * DAY), actor: admin, action: "user.role_change", entityType: "user", entityId: SEED_CREDENTIALS.staff.id, summary: "Changed role of staff@apexline.example", changes: { role: { from: "customer", to: "staff" } } },
    { at: clock.ago(14 * DAY), actor: staff, action: "review.moderate", entityType: "review", entityId: "rev_0003", summary: "Approved review rev_0003" },
    { at: clock.ago(11 * DAY), actor: staff, action: "banner.update", entityType: "banner", entityId: "ban_hero_brakes", summary: "Scheduled the brakes hero banner", changes: { endsAt: { from: null, to: clock.ahead(20 * DAY) } } },
    ...(deliveredOrder ? [{ at: clock.ago(8 * DAY + 2 * HOUR), actor: staff, action: "order.status_change", entityType: "order", entityId: deliveredOrder.id, summary: `Marked ${deliveredOrder.number} as delivered`, changes: { status: { from: "shipped", to: "delivered" } } } as Omit<AuditEntry, "id">] : []),
    { at: clock.ago(5 * DAY), actor: admin, action: "page.update", entityType: "page", entityId: "pge_shipping", summary: "Updated the Shipping & Delivery page" },
    { at: clock.ago(2 * DAY + rng.int(0, 5) * HOUR), actor: staff, action: "product.update", entityType: "product", entityId: p2.product.id, summary: `Updated specifications of ${p2.product.name.en}` },
  ];
  return entries
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((e, i) => ({ id: `aud_${pad(i + 1, 3)}`, ...e }));
}

const SEARCHES: [string, number][] = [
  ["brake pads", 14],
  ["oil filter", 12],
  ["spark plug", 10],
  ["balata", 9],
  ["yağ filtresi", 8],
  ["battery", 8],
  ["akü", 7],
  ["wiper blades", 6],
  ["5w-30", 6],
  ["cabin filter", 5],
  ["polen filtresi", 5],
  ["headlight bulb h7", 5],
  ["timing belt", 4],
  ["amortisör", 4],
  ["radiator", 3],
  ["silecek", 3],
  ["brake discs", 3],
  ["alternator", 2],
  ["triger seti", 2],
  ["coolant", 2],
];

export function buildSearchLog(clock: SeedClock): { id: string; q: string; resultCount: number; at: string }[] {
  const rng = new Rng("searchlog");
  const rows: { id: string; q: string; resultCount: number; at: string }[] = [];
  let n = 0;
  for (const [q, times] of SEARCHES) {
    for (let i = 0; i < times; i++) {
      n++;
      rows.push({ id: `sch_${pad(n, 4)}`, q, resultCount: rng.int(2, 24), at: clock.ago(rng.int(1, 28 * 24) * HOUR) });
    }
  }
  return rows.sort((a, b) => a.at.localeCompare(b.at));
}
