import "server-only";
import { z } from "zod";
import { zodFieldErrors } from "@/lib/action-result";
import { db } from "@/lib/db";
import { DomainError, notFound } from "@/lib/errors";
import type { Actor, Address, AddressInput, Cents, Id, Order, User } from "@/lib/types/domain";
import { addressInputSchema, phoneSchema } from "@/lib/validation/common";
import type { ProfileInput } from "./contracts";
import { logAudit } from "./audit";
import { normalizeEmail, nowIso } from "./_shared";

const MAX_ADDRESSES = 20;

function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new DomainError("validation_failed", { fieldErrors: zodFieldErrors(parsed.error) });
  return parsed.data;
}

const profileSchema = z.object({
  name: z.string().trim().min(1, "required").max(80, "too_long"),
  phone: z.union([phoneSchema, z.literal(""), z.null()]).optional(),
  locale: z.enum(["en", "tr"]),
  marketingOptIn: z.boolean(),
});

export async function getUserById(id: Id): Promise<User | null> {
  return db.users.get(id);
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const e = normalizeEmail(email);
  return db.users.findOne((u) => u.email.toLowerCase() === e);
}

export async function updateProfile(userId: Id, input: ProfileInput): Promise<User> {
  const data = parse(profileSchema, input);
  return db.transaction(async () => {
    const user = await db.users.get(userId);
    if (!user) throw notFound("account");
    return db.users.update(userId, { name: data.name, phone: data.phone ? data.phone : null, locale: data.locale, marketingOptIn: data.marketingOptIn, updatedAt: nowIso() });
  });
}

const PAID: Order["paymentStatus"][] = ["paid", "partially_refunded", "refunded"];

export function netSpent(order: Pick<Order, "paymentStatus" | "total" | "refundedTotal">): Cents {
  return PAID.includes(order.paymentStatus) ? Math.max(0, order.total - order.refundedTotal) : 0;
}

export async function getAccountSummary(userId: Id): Promise<{ orderCount: number; wishlistCount: number; addressCount: number; lastOrder?: Order; totalSpent: Cents }> {
  const [orders, wishlist, addressCount] = await Promise.all([
    db.orders.find({ where: (o) => o.userId === userId && !(o.status === "pending_payment" && o.paymentStatus === "failed"), orderBy: [{ field: "createdAt", direction: "desc" }] }),
    db.wishlists.findOne((w) => w.userId === userId),
    db.addresses.count((a) => a.userId === userId),
  ]);
  const lastOrder = orders[0];
  return {
    orderCount: orders.length,
    wishlistCount: wishlist?.productIds.length ?? 0,
    addressCount,
    ...(lastOrder ? { lastOrder: { ...lastOrder, internalNotes: [] } } : {}),
    totalSpent: orders.reduce((s, o) => s + netSpent(o), 0),
  };
}

export async function listAddresses(userId: Id): Promise<Address[]> {
  const rows = await db.addresses.find({ where: (a) => a.userId === userId });
  return rows.sort((a, b) => Number(b.isDefaultShipping) - Number(a.isDefaultShipping) || Number(b.isDefaultBilling) - Number(a.isDefaultBilling) || (a.label ?? "").localeCompare(b.label ?? ""));
}

type AddressWrite = AddressInput & { isDefaultShipping?: boolean; isDefaultBilling?: boolean };

async function clearDefaults(userId: Id, kinds: { shipping?: boolean; billing?: boolean }, exceptId?: Id) {
  const rows = await db.addresses.find({ where: (a) => a.userId === userId && a.id !== exceptId && ((kinds.shipping && a.isDefaultShipping) || (kinds.billing && a.isDefaultBilling) || false) });
  for (const a of rows) {
    await db.addresses.update(a.id, { ...(kinds.shipping ? { isDefaultShipping: false } : {}), ...(kinds.billing ? { isDefaultBilling: false } : {}) });
  }
}

function clean(address: z.output<typeof addressInputSchema>): AddressInput {
  const { label, company, line2, ...rest } = address;
  return { ...rest, ...(label ? { label } : {}), ...(company ? { company } : {}), ...(line2 ? { line2 } : {}) };
}

export async function createAddress(userId: Id, input: AddressWrite): Promise<Address> {
  const { isDefaultShipping, isDefaultBilling, ...fields } = input;
  const data = clean(parse(addressInputSchema, fields));
  return db.transaction(async () => {
    if (!(await db.users.get(userId))) throw notFound("account");
    const existing = await db.addresses.count((a) => a.userId === userId);
    if (existing >= MAX_ADDRESSES) throw new DomainError("address_invalid", { status: 409 });
    const first = existing === 0;
    const ship = first || Boolean(isDefaultShipping);
    const bill = first || Boolean(isDefaultBilling);
    await clearDefaults(userId, { shipping: ship, billing: bill });
    return db.addresses.insert({ ...data, userId, isDefaultShipping: ship, isDefaultBilling: bill });
  });
}

export async function updateAddress(userId: Id, addressId: Id, input: Partial<AddressInput> & { isDefaultShipping?: boolean; isDefaultBilling?: boolean }): Promise<Address> {
  return db.transaction(async () => {
    const current = await db.addresses.get(addressId);
    if (!current || current.userId !== userId) throw notFound("address");
    const { isDefaultShipping, isDefaultBilling, ...fields } = input;
    const { id: _id, userId: _u, isDefaultShipping: _s, isDefaultBilling: _b, ...currentFields } = current;
    void _id;
    void _u;
    void _s;
    void _b;
    const merged = clean(parse(addressInputSchema, { ...currentFields, ...fields }));
    await clearDefaults(userId, { shipping: isDefaultShipping === true, billing: isDefaultBilling === true }, addressId);
    const next = await db.addresses.update(addressId, {
      ...merged,
      // optional text fields cleared in the form must be removed from the row
      label: merged.label,
      company: merged.company,
      line2: merged.line2,
      ...(isDefaultShipping !== undefined ? { isDefaultShipping } : {}),
      ...(isDefaultBilling !== undefined ? { isDefaultBilling } : {}),
    });
    return next;
  });
}

export async function deleteAddress(userId: Id, addressId: Id): Promise<void> {
  await db.transaction(async () => {
    const current = await db.addresses.get(addressId);
    if (!current || current.userId !== userId) throw notFound("address");
    await db.addresses.delete(addressId);
    const rest = await db.addresses.find({ where: (a) => a.userId === userId });
    const promote = rest[0];
    if (promote) {
      if (current.isDefaultShipping && !rest.some((a) => a.isDefaultShipping)) await db.addresses.update(promote.id, { isDefaultShipping: true });
      if (current.isDefaultBilling && !rest.some((a) => a.isDefaultBilling)) await db.addresses.update(promote.id, { isDefaultBilling: true });
    }
  });
}

/**
 * Deletes the account and everything personal that hangs off it. Orders are kept for accounting but anonymised
 * (email, names, street, phone); city/country stay for tax records. Reviews stay without the author link.
 */
export async function deleteAccount(userId: Id): Promise<void> {
  const user = await db.users.get(userId);
  if (!user) throw notFound("account");
  await purgeUser(userId, { id: userId, email: user.email, role: user.role });
}

/** Shared by self-service deletion and staff deletion (audit actor differs). */
export async function purgeUser(userId: Id, actor: Actor): Promise<void> {
  await db.transaction(async () => {
    const user = await db.users.get(userId);
    if (!user) throw notFound("account");
    if (user.role === "admin") {
      const otherAdmins = await db.users.count((u) => u.role === "admin" && u.id !== userId && !u.disabled);
      if (otherAdmins === 0) throw new DomainError("last_admin", { status: 409 });
    }
    const alias = `deleted-${userId.replace(/[^a-z0-9]/gi, "").slice(-10)}@deleted.invalid`;
    const anonymise = (a: AddressInput): AddressInput => ({ firstName: "Deleted", lastName: "Customer", line1: "Removed", city: a.city, region: a.region, postalCode: a.postalCode, country: a.country, phone: "" });

    const orders = await db.orders.find({ where: (o) => o.userId === userId });
    for (const order of orders) {
      await db.orders.update(order.id, {
        userId: null,
        email: alias,
        shippingAddress: anonymise(order.shippingAddress),
        billingAddress: anonymise(order.billingAddress),
        customerNote: undefined,
        updatedAt: nowIso(),
      });
    }
    await db.addresses.deleteWhere((a) => a.userId === userId);
    await db.wishlists.deleteWhere((w) => w.userId === userId);
    await db.carts.deleteWhere((c) => c.userId === userId);
    await db.authSessions.deleteWhere((s) => s.userId === userId);
    await db.authAccounts.deleteWhere((a) => a.userId === userId);
    await db.authVerifications.deleteWhere((v) => v.value === userId);
    const reviews = await db.reviews.find({ where: (r) => r.userId === userId });
    for (const r of reviews) await db.reviews.update(r.id, { userId: null, authorName: "Former customer" });
    const redemptions = await db.couponRedemptions.find({ where: (r) => r.userId === userId });
    for (const r of redemptions) await db.couponRedemptions.update(r.id, { userId: null, email: alias });
    await db.users.delete(userId);
    await logAudit({ actor, action: "user.delete", entityType: "user", entityId: userId, summary: `Account deleted (${user.role})` });
  });
}
