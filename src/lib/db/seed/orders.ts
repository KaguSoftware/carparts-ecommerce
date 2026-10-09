import { allocate, applyBps, percentOf } from "@/lib/money";
import type {
  Actor,
  AddressInput,
  InventoryMovement,
  Order,
  OrderEvent,
  OrderItem,
  OrderStatus,
  Payment,
  Refund,
  ShippingMethod,
  TaxRate,
} from "@/lib/types/domain";
import { BRAND_DEFS } from "./brands";
import { categoryId } from "./categories";
import type { CatalogData, BuiltProduct } from "./catalog/build";
import type { CouponSeed } from "./commerce";
import { FIRST_ORDER_NUMBER, ORDER_PREFIX, TRY_PER_USD } from "./commerce";
import { SEED_CREDENTIALS } from "./credentials";
import { CUSTOMERS, WORKSHOP_ADDRESS } from "./people";
import { DAY, HOUR, MINUTE, Rng, SYSTEM_ACTOR, hashString, pad, type SeedClock } from "./util";

type Special = "failed" | "refund_full" | "refund_partial" | "cancel_paid" | "cancel_unpaid" | "pending_3ds" | "pending";

interface Blueprint {
  /** days ago the order was placed (fractions allowed) */
  d: number;
  user: string | null;
  guest?: string;
  ship: string;
  n: number;
  coupon?: string;
  status?: OrderStatus;
  special?: Special;
  focus?: string;
  note?: string;
  noteTr?: string;
  customerNote?: string;
}

const GUESTS: Record<string, { email: string; address: AddressInput; locale: "en" | "tr" }> = {
  g1: { email: "marcus.bell@mail.example", locale: "en", address: { firstName: "Marcus", lastName: "Bell", line1: "1740 Woodward Ave", city: "Detroit", region: "MI", postalCode: "48226", country: "US", phone: "+1 313 555 0133" } },
  g2: { email: "priya.nair@mail.example", locale: "en", address: { firstName: "Priya", lastName: "Nair", line1: "2200 Mission St", city: "San Francisco", region: "CA", postalCode: "94110", country: "US", phone: "+1 415 555 0182" } },
  g3: { email: "tom.hughes@mail.example", locale: "en", address: { firstName: "Tom", lastName: "Hughes", line1: "22 Mill Lane", city: "Manchester", region: "England", postalCode: "M1 4BT", country: "GB", phone: "+44 161 496 0187" } },
  g4: { email: "merve.celik@mail.example", locale: "tr", address: { firstName: "Merve", lastName: "Çelik", line1: "Nilüfer Mah. Fethiye Cad. No: 9", city: "Bursa", region: "Bursa", postalCode: "16110", country: "TR", phone: "+90 536 555 01 45" } },
};

const CU = SEED_CREDENTIALS.customer.id;

const BLUEPRINTS: Blueprint[] = [
  { d: 74, user: "usr_c01", ship: "shp_standard", n: 2, coupon: "WELCOME10" },
  { d: 71, user: "usr_c02", ship: "shp_standard", n: 1 },
  { d: 68, user: "usr_c03", ship: "shp_tr_standard", n: 3, coupon: "SPRING20" },
  { d: 64, user: null, guest: "g1", ship: "shp_standard", n: 2 },
  { d: 60, user: CU, ship: "shp_standard", n: 3, coupon: "WELCOME10" },
  { d: 57, user: "usr_c05", ship: "shp_international", n: 2 },
  { d: 54, user: "usr_c07", ship: "shp_express", n: 2, coupon: "SPRING20" },
  { d: 51, user: "usr_c04", ship: "shp_tr_express", n: 1 },
  { d: 47, user: "usr_c09", ship: "shp_pickup", n: 2 },
  { d: 44, user: "usr_c01", ship: "shp_standard", n: 2, special: "refund_partial", note: "Customer reported one unit arrived with a damaged box. Partial refund issued, unit restocked." },
  { d: 41, user: "usr_c06", ship: "shp_international", n: 3 },
  { d: 38, user: CU, ship: "shp_express", n: 2, note: "Customer asked for delivery to the workshop address.", noteTr: "Müşteri teslimatın atölye adresine yapılmasını istedi." },
  { d: 35, user: "usr_c02", ship: "shp_standard", n: 4, coupon: "SAVE25" },
  { d: 32, user: "usr_c08", ship: "shp_tr_standard", n: 2 },
  { d: 29, user: null, guest: "g2", ship: "shp_standard", n: 2, special: "refund_full", note: "Wrong vehicle ordered. Full refund after return inspection." },
  { d: 26, user: "usr_c03", ship: "shp_tr_express", n: 2 },
  { d: 23, user: "usr_c07", ship: "shp_standard", n: 3, coupon: "FREESHIP" },
  { d: 21, user: "usr_c09", ship: "shp_standard", n: 2, special: "cancel_paid", note: "Cancelled by customer before dispatch. Refunded in full." },
  { d: 19, user: CU, ship: "shp_standard", n: 2 },
  { d: 17, user: null, guest: "g3", ship: "shp_international", n: 2 },
  { d: 15, user: "usr_c05", ship: "shp_international", n: 1 },
  { d: 13, user: "usr_c04", ship: "shp_tr_standard", n: 3, coupon: "FILTERS10", focus: "filters" },
  { d: 12.5, user: null, guest: "g3", ship: "shp_standard", n: 1, special: "cancel_unpaid" },
  { d: 11, user: "usr_c02", ship: "shp_express", n: 2 },
  { d: 9, user: "usr_c01", ship: "shp_standard", n: 3, coupon: "BRAKES15", focus: "brakes" },
  { d: 9, user: CU, ship: "shp_standard", n: 2, coupon: "VIP20", status: "shipped", note: "Carrier delayed at the Chicago hub. Customer notified." },
  { d: 8, user: "usr_c07", ship: "shp_standard", n: 2 },
  { d: 7, user: null, guest: "g4", ship: "shp_tr_standard", n: 2 },
  { d: 6, user: "usr_c06", ship: "shp_international", n: 2 },
  { d: 5, user: "usr_c08", ship: "shp_tr_express", n: 2 },
  { d: 4, user: "usr_c09", ship: "shp_pickup", n: 1 },
  { d: 3, user: CU, ship: "shp_standard", n: 2, customerNote: "Please call before delivery." },
  { d: 2, user: "usr_c02", ship: "shp_standard", n: 3, coupon: "BRAKES15", focus: "brakes" },
  { d: 1.2, user: null, guest: "g1", ship: "shp_express", n: 2 },
  { d: 0.8, user: "usr_c03", ship: "shp_tr_standard", n: 2, special: "pending_3ds" },
  { d: 0.3, user: "usr_c07", ship: "shp_standard", n: 2, special: "failed" },
  { d: 0.15, user: null, guest: "g2", ship: "shp_standard", n: 1, special: "pending" },
];

export interface OrdersData {
  orders: Order[];
  payments: Payment[];
  movements: InventoryMovement[];
  redemptions: { id: string; couponId: string; orderId: string; userId: string | null; email: string; at: string }[];
  /** variantId -> final stock */
  stock: Map<string, { onHand: number; reserved: number }>;
  unitsSold: Map<string, number>;
  /** userId -> product ids delivered / shipped to them */
  purchased: Map<string, Set<string>>;
  couponUses: Map<string, number>;
  nextOrderNumber: number;
}

const STAFF_ACTOR: Actor = { id: SEED_CREDENTIALS.staff.id, email: SEED_CREDENTIALS.staff.email, role: "staff" };
const ADMIN_ACTOR: Actor = { id: SEED_CREDENTIALS.admin.id, email: SEED_CREDENTIALS.admin.email, role: "admin" };

function token(rng: Rng, length: number): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[rng.int(0, alphabet.length - 1)];
  return out;
}

function uuidLike(rng: Rng): string {
  const h = () => Array.from({ length: 4 }, () => rng.int(0, 15).toString(16)).join("");
  return `${h()}${h()}-${h()}-4${h().slice(1)}-a${h().slice(1)}-${h()}${h()}${h()}`;
}

export function buildOrders(
  clock: SeedClock,
  catalog: CatalogData,
  coupons: CouponSeed[],
  shipping: ShippingMethod[],
  taxRates: TaxRate[],
): OrdersData {
  const stock = new Map<string, { onHand: number; reserved: number }>();
  for (const b of catalog.built) for (const v of b.variants) stock.set(v.id, { onHand: b.initialStock[v.id] ?? v.stockOnHand, reserved: 0 });

  const orders: Order[] = [];
  const payments: Payment[] = [];
  const movements: InventoryMovement[] = [];
  const redemptions: OrdersData["redemptions"] = [];
  const unitsSold = new Map<string, number>();
  const purchased = new Map<string, Set<string>>();
  const couponUses = new Map<string, number>();
  let movSeq = 0;

  const customerById = new Map(CUSTOMERS.map((c) => [c.id, c]));
  const methodById = new Map(shipping.map((m) => [m.id, m]));
  const couponByCode = new Map(coupons.map((c) => [c.coupon.code, c.coupon]));

  const pushMovement = (variantId: string, productId: string, delta: number, reservedDelta: number, reason: InventoryMovement["reason"], reference: string, atMs: number, actor: Actor, note?: string) => {
    const s = stock.get(variantId);
    if (!s) return;
    s.onHand += delta;
    s.reserved += reservedDelta;
    movSeq++;
    movements.push({
      id: `inv_sale_${pad(movSeq, 4)}`,
      variantId,
      productId,
      delta,
      reservedDelta,
      reason,
      reference,
      ...(note ? { note } : {}),
      actor,
      onHandAfter: s.onHand,
      reservedAfter: s.reserved,
      createdAt: new Date(atMs).toISOString(),
    });
  };

  const sorted = [...BLUEPRINTS].sort((a, b) => b.d - a.d);
  const activeBuilt = catalog.built.filter((b) => b.product.status === "active");

  sorted.forEach((bp, index) => {
    const number = `${ORDER_PREFIX}${FIRST_ORDER_NUMBER + index}`;
    const orderRng = new Rng(`order:${number}`);
    const createdMs = clock.now - bp.d * DAY;

    const customer = bp.user ? customerById.get(bp.user) : undefined;
    const guest = bp.guest ? GUESTS[bp.guest] : undefined;
    const email = customer?.email ?? guest!.email;
    const locale: "en" | "tr" = customer?.locale ?? guest!.locale;
    let shippingAddress: AddressInput = customer?.address ?? guest!.address;
    if (bp.user === CU && bp.note?.includes("workshop")) shippingAddress = WORKSHOP_ADDRESS;
    const billingAddress = customer?.address ?? shippingAddress;
    const method = methodById.get(bp.ship)!;

    /* ---- pick lines ---- */
    const coupon = bp.coupon ? couponByCode.get(bp.coupon) : undefined;
    const minSubtotal = coupon?.minSubtotal ?? 0;
    const focusId = bp.focus ? categoryId(bp.focus) : null;
    const eligible = activeBuilt.filter(
      (b) =>
        Date.parse(b.product.createdAt) < createdMs - DAY &&
        (!focusId || b.product.categoryIds.includes(focusId)) &&
        b.variants.some((v) => (stock.get(v.id)?.onHand ?? 0) - (stock.get(v.id)?.reserved ?? 0) >= 1),
    );
    const chosen: { built: BuiltProduct; variantId: string; qty: number }[] = [];
    const used = new Set<string>();
    let subtotal = 0;
    let attempts = 0;
    while ((chosen.length < bp.n || subtotal < minSubtotal) && attempts < 60 && chosen.length < 7) {
      attempts++;
      const pickFrom = subtotal < minSubtotal ? eligible.filter((b) => (b.variants[0]?.price ?? 0) > 6000) : eligible;
      const pool = pickFrom.length ? pickFrom : eligible;
      const b = orderRng.sampleWeighted(pool, (x) => (x.product.isFeatured ? 3 : 1), 1)[0];
      if (!b || used.has(b.product.id)) continue;
      const variants = b.variants.filter((v) => v.isActive && (stock.get(v.id)?.onHand ?? 0) - (stock.get(v.id)?.reserved ?? 0) >= 1);
      if (!variants.length) continue;
      const variant = orderRng.chance(0.7) ? (variants.find((v) => v.isDefault) ?? variants[0]!) : orderRng.pick(variants);
      const free = (stock.get(variant.id)?.onHand ?? 0) - (stock.get(variant.id)?.reserved ?? 0);
      const bulky = variant.price > 12000;
      const qty = Math.min(free, bulky ? 1 : orderRng.chance(0.7) ? 1 : orderRng.chance(0.75) ? 2 : orderRng.int(3, 4));
      used.add(b.product.id);
      chosen.push({ built: b, variantId: variant.id, qty });
      subtotal += variant.price * qty;
    }

    if (chosen.length === 0) throw new Error(`Seed: no eligible products for order ${number}`);

    /* ---- money ---- */
    const lineRaw = chosen.map((c) => {
      const v = c.built.variants.find((x) => x.id === c.variantId)!;
      return { c, v, gross: v.price * c.qty };
    });
    subtotal = lineRaw.reduce((s, l) => s + l.gross, 0);

    let discount = 0;
    let freeShipping = false;
    const eligibleWeights = lineRaw.map((l) => {
      const ids = coupon?.appliesTo?.categoryIds;
      return !ids || ids.some((id) => l.c.built.product.categoryIds.includes(id)) ? l.gross : 0;
    });
    if (coupon) {
      const base = eligibleWeights.reduce((s, w) => s + w, 0);
      if (coupon.type === "percent") discount = Math.min(percentOf(base, coupon.value), coupon.maxDiscount ?? Infinity);
      else if (coupon.type === "fixed") discount = Math.min(coupon.value, base);
      else freeShipping = true;
    }
    const discountByLine = discount > 0 ? allocate(discount, eligibleWeights) : lineRaw.map(() => 0);

    const totalGrams = lineRaw.reduce((s, l) => s + l.v.weightGrams * l.c.qty, 0);
    let shippingCost = method.price + method.perKgPrice * Math.max(0, Math.floor(totalGrams / 1000) - 1);
    if (method.freeOverSubtotal !== undefined && subtotal - discount >= method.freeOverSubtotal) shippingCost = 0;
    if (freeShipping) shippingCost = 0;

    const region = shippingAddress.region.toLowerCase();
    const rate =
      taxRates.find((r) => r.isActive && r.country === shippingAddress.country && r.region.toLowerCase() === region && r.region !== "") ??
      taxRates.find((r) => r.isActive && r.country === shippingAddress.country && r.region === "");
    const taxable = subtotal - discount + (rate?.appliesToShipping ? shippingCost : 0);
    const tax = rate ? applyBps(taxable, rate.rateBps) : 0;
    const total = subtotal - discount + shippingCost + tax;
    const lineNets = lineRaw.map((l, i) => l.gross - (discountByLine[i] ?? 0));
    const taxByLine = tax > 0 ? allocate(tax, lineNets) : lineNets.map(() => 0);

    const currency = locale === "tr" ? "TRY" : "USD";
    const fxRate = locale === "tr" ? TRY_PER_USD : 1;
    const chargedTotal = Math.round(total * fxRate);

    /* ---- lifecycle ---- */
    let status: OrderStatus;
    if (bp.status) status = bp.status;
    else if (bp.special === "failed" || bp.special === "pending" || bp.special === "pending_3ds") status = "pending_payment";
    else if (bp.special === "cancel_paid" || bp.special === "cancel_unpaid") status = "cancelled";
    else if (bp.special === "refund_full") status = "refunded";
    else if (bp.d >= 8) status = "delivered";
    else if (bp.d >= 3) status = "shipped";
    else status = "processing";

    const paid = !["failed", "pending", "pending_3ds", "cancel_unpaid"].includes(bp.special ?? "");
    const paidMs = createdMs + 2 * MINUTE + orderRng.int(0, 90) * 1000;
    const shippedMs = createdMs + DAY + orderRng.int(2, 10) * HOUR;
    const deliveredMs = shippedMs + Math.round(((method.estimatedDaysMin + method.estimatedDaysMax) / 2) * DAY);
    const isPickup = method.code === "pickup";

    /* ---- items ---- */
    const items: OrderItem[] = lineRaw.map((l, i) => {
      const p = l.c.built.product;
      return {
        id: `oit_${number.slice(3)}_${i + 1}`,
        productId: p.id,
        variantId: l.v.id,
        sku: l.v.sku,
        name: p.name,
        variantName: l.v.name,
        brandName: brandName(l.c.built),
        image: p.images[0]?.url,
        quantity: l.c.qty,
        unitPrice: l.v.price,
        discount: discountByLine[i] ?? 0,
        tax: taxByLine[i] ?? 0,
        lineTotal: lineNets[i] ?? 0,
        refundedQuantity: 0,
      };
    });

    /* ---- inventory + payment ---- */
    const reference = number;
    const events: OrderEvent[] = [];
    let evt = 0;
    const addEvent = (atMs: number, type: OrderEvent["type"], actor: Actor, extra: Partial<OrderEvent> = {}) =>
      events.push({ id: `evt_${number.slice(3)}_${++evt}`, at: new Date(atMs).toISOString(), type, actor, ...extra });
    const customerActor: Actor = customer ? { id: customer.id, email: customer.email, role: "customer" } : { ...SYSTEM_ACTOR };

    addEvent(createdMs, "created", customerActor, { status: "pending_payment", message: "Order placed" });

    const paymentId = `pay_${number.slice(3)}`;
    const cardPool = [
      { brand: "visa", last4: "4242" },
      { brand: "mastercard", last4: "4444" },
      { brand: "visa", last4: "1881" },
      { brand: "amex", last4: "0005" },
    ];
    const card = orderRng.pick(cardPool);
    const method_ = { ...card, expMonth: orderRng.int(1, 12), expYear: 2027 + orderRng.int(0, 3) };
    const providerRef = `mock_pi_${hashString(number).toString(36)}${hashString(email).toString(36)}`;
    const refunds: Refund[] = [];
    let paymentStatus: Order["paymentStatus"] = "unpaid";
    let paymentIntentStatus: Payment["status"] = "requires_payment_method";
    let failureCode: string | undefined;
    let refundedTotal = 0;
    let trackingNumber: string | undefined;
    let carrier: string | undefined;
    let shippedAt: string | undefined;
    let deliveredAt: string | undefined;

    const reserveAll = (atMs: number) => items.forEach((it) => pushMovement(it.variantId, it.productId, 0, it.quantity, "reservation", reference, atMs, SYSTEM_ACTOR, "Held for checkout"));
    const releaseAll = (atMs: number) => items.forEach((it) => pushMovement(it.variantId, it.productId, 0, -it.quantity, "release", reference, atMs, SYSTEM_ACTOR, "Reservation released"));

    if (bp.special === "pending" || bp.special === "pending_3ds") {
      reserveAll(createdMs);
      paymentIntentStatus = bp.special === "pending_3ds" ? "requires_action" : "requires_payment_method";
    } else if (bp.special === "failed") {
      reserveAll(createdMs);
      releaseAll(createdMs + 40 * 1000);
      paymentStatus = "failed";
      paymentIntentStatus = "failed";
      failureCode = "card_declined";
      addEvent(createdMs + 40 * 1000, "payment_failed", SYSTEM_ACTOR, { message: "card_declined" });
    } else if (bp.special === "cancel_unpaid") {
      reserveAll(createdMs);
      releaseAll(createdMs + 30 * MINUTE);
      paymentIntentStatus = "cancelled";
      addEvent(createdMs + 30 * MINUTE, "cancelled", SYSTEM_ACTOR, { status: "cancelled", message: "Payment window expired" });
    }

    if (paid) {
      paymentStatus = "paid";
      paymentIntentStatus = "succeeded";
      items.forEach((it) => pushMovement(it.variantId, it.productId, -it.quantity, 0, "sale", reference, paidMs, SYSTEM_ACTOR));
      addEvent(paidMs, "paid", SYSTEM_ACTOR, { message: `${card.brand.toUpperCase()} ****${card.last4}` });
      addEvent(paidMs, "status_changed", SYSTEM_ACTOR, { status: "processing" });
      for (const it of items) unitsSold.set(it.productId, (unitsSold.get(it.productId) ?? 0) + it.quantity);

      const reachesShipped = status === "shipped" || status === "delivered" || bp.special === "refund_partial" || bp.special === "refund_full";
      if (reachesShipped) {
        carrier = isPickup ? undefined : method.countries.includes("TR") ? "Yurtiçi Kargo" : shippingAddress.country === "US" || shippingAddress.country === "CA" ? "UPS" : "DHL";
        trackingNumber = isPickup
          ? undefined
          : carrier === "UPS"
            ? `1Z999AA1${orderRng.int(10000000, 99999999)}${orderRng.int(10, 99)}`
            : carrier === "DHL"
              ? `JD0146${orderRng.int(1000000000, 9999999999)}`
              : `${orderRng.int(100000000000, 999999999999)}`;
        shippedAt = new Date(shippedMs).toISOString();
        addEvent(shippedMs, "shipped", STAFF_ACTOR, { status: "shipped", message: isPickup ? "Ready for pickup" : `${carrier} ${trackingNumber}` });
        addEvent(shippedMs + 5 * MINUTE, "email_sent", SYSTEM_ACTOR, { message: "shipping_update" });
      }
      const reachesDelivered = status === "delivered" || bp.special === "refund_partial" || bp.special === "refund_full";
      if (reachesDelivered) {
        deliveredAt = new Date(deliveredMs).toISOString();
        addEvent(deliveredMs, "status_changed", STAFF_ACTOR, { status: "delivered" });
      }

      if (bp.special === "refund_partial") {
        const it = items[0]!;
        const perUnit = Math.round((it.lineTotal + it.tax) / it.quantity);
        const refundMs = deliveredMs + 2 * DAY;
        refundedTotal = perUnit;
        it.refundedQuantity = 1;
        paymentStatus = "partially_refunded";
        refunds.push({
          id: `ref_${number.slice(3)}_1`,
          at: new Date(refundMs).toISOString(),
          amount: perUnit,
          amountCharged: Math.round(perUnit * fxRate),
          reason: "Damaged in transit",
          providerRef: `mock_re_${hashString(number + "p").toString(36)}`,
          items: [{ orderItemId: it.id, quantity: 1 }],
          restock: true,
          actor: ADMIN_ACTOR,
        });
        pushMovement(it.variantId, it.productId, 1, 0, "return", reference, refundMs, ADMIN_ACTOR, "Partial refund restock");
        addEvent(refundMs, "refund", ADMIN_ACTOR, { message: "Partial refund: damaged in transit" });
        unitsSold.set(it.productId, (unitsSold.get(it.productId) ?? 0) - 1);
      } else if (bp.special === "refund_full") {
        const refundMs = deliveredMs + 4 * DAY;
        refundedTotal = total;
        paymentStatus = "refunded";
        refunds.push({
          id: `ref_${number.slice(3)}_1`,
          at: new Date(refundMs).toISOString(),
          amount: total,
          amountCharged: chargedTotal,
          reason: "Wrong vehicle ordered",
          providerRef: `mock_re_${hashString(number + "f").toString(36)}`,
          restock: true,
          actor: ADMIN_ACTOR,
        });
        for (const it of items) {
          it.refundedQuantity = it.quantity;
          pushMovement(it.variantId, it.productId, it.quantity, 0, "return", reference, refundMs, ADMIN_ACTOR, "Full refund restock");
          unitsSold.set(it.productId, (unitsSold.get(it.productId) ?? 0) - it.quantity);
        }
        addEvent(refundMs, "refund", ADMIN_ACTOR, { status: "refunded", message: "Full refund: wrong vehicle ordered" });
      } else if (bp.special === "cancel_paid") {
        const cancelMs = paidMs + 5 * HOUR;
        refundedTotal = total;
        paymentStatus = "refunded";
        refunds.push({
          id: `ref_${number.slice(3)}_1`,
          at: new Date(cancelMs).toISOString(),
          amount: total,
          amountCharged: chargedTotal,
          reason: "Cancelled by customer",
          providerRef: `mock_re_${hashString(number + "c").toString(36)}`,
          restock: true,
          actor: STAFF_ACTOR,
        });
        for (const it of items) {
          it.refundedQuantity = it.quantity;
          pushMovement(it.variantId, it.productId, it.quantity, 0, "return", reference, cancelMs, STAFF_ACTOR, "Order cancelled");
          unitsSold.set(it.productId, (unitsSold.get(it.productId) ?? 0) - it.quantity);
        }
        addEvent(cancelMs, "cancelled", STAFF_ACTOR, { status: "cancelled", message: "Cancelled by customer before dispatch" });
      }

      if (coupon) {
        const uses = (couponUses.get(coupon.code) ?? 0) + 1;
        couponUses.set(coupon.code, uses);
        redemptions.push({ id: `red_${number.slice(3)}`, couponId: coupon.id, orderId: `ord_${number.slice(3)}`, userId: customer?.id ?? null, email, at: new Date(paidMs).toISOString() });
      }
      if (customer && (status === "delivered" || status === "shipped")) {
        const set = purchased.get(customer.id) ?? new Set<string>();
        for (const it of items) set.add(it.productId);
        purchased.set(customer.id, set);
      }
      addEvent(paidMs + MINUTE, "email_sent", SYSTEM_ACTOR, { message: "order_confirmation" });
    }

    events.sort((a, b) => a.at.localeCompare(b.at));
    const lastEventMs = Date.parse(events[events.length - 1]!.at);
    const order: Order = {
      id: `ord_${number.slice(3)}`,
      number,
      userId: customer?.id ?? null,
      email,
      status,
      paymentStatus,
      items,
      shippingAddress,
      billingAddress,
      shippingMethod: { id: method.id, code: method.code, name: method.name, price: shippingCost, estimatedDaysMin: method.estimatedDaysMin, estimatedDaysMax: method.estimatedDaysMax },
      ...(coupon ? { couponCode: coupon.code } : {}),
      subtotal,
      discount,
      shipping: shippingCost,
      tax,
      total,
      currency,
      fxRate,
      chargedTotal,
      refundedTotal,
      locale,
      ...(bp.customerNote ? { customerNote: bp.customerNote } : {}),
      ...(trackingNumber ? { trackingNumber } : {}),
      ...(carrier ? { carrier } : {}),
      ...(shippedAt ? { shippedAt } : {}),
      ...(deliveredAt ? { deliveredAt } : {}),
      accessToken: token(orderRng, 43),
      idempotencyKey: uuidLike(orderRng),
      events,
      internalNotes: bp.note
        ? [{ id: `note_${number.slice(3)}_1`, at: new Date(Math.min(clock.now, lastEventMs + HOUR)).toISOString(), by: "Noah Whitfield", body: locale === "tr" && bp.noteTr ? bp.noteTr : bp.note }]
        : [],
      paymentId,
      createdAt: new Date(createdMs).toISOString(),
      updatedAt: new Date(Math.min(clock.now, lastEventMs)).toISOString(),
    };
    orders.push(order);

    payments.push({
      id: paymentId,
      orderId: order.id,
      provider: "mock",
      providerRef,
      amount: chargedTotal,
      currency,
      status: paymentIntentStatus,
      ...(paymentIntentStatus === "succeeded" || paymentIntentStatus === "requires_action" || paymentIntentStatus === "failed" ? { method: method_ } : {}),
      ...(failureCode ? { failureCode } : {}),
      refunds,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    });
  });

  // Chronological, renumbered movement ids so the ledger reads like a real one.
  movements.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return {
    orders: orders.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    payments,
    movements,
    redemptions,
    stock,
    unitsSold,
    purchased,
    couponUses,
    nextOrderNumber: FIRST_ORDER_NUMBER + sorted.length,
  };
}

function brandName(b: BuiltProduct): string {
  return BRAND_DEFS.find((d) => d.key === b.offer.brand)?.name ?? b.offer.brand;
}
