import "server-only";
import { z } from "zod";
import { zodFieldErrors } from "@/lib/action-result";
import { db } from "@/lib/db";
import { DomainError, notFound } from "@/lib/errors";
import type { Actor, Cents, Id, ShippingMethod, ShippingQuote } from "@/lib/types/domain";
import type { ShippingMethodInput } from "./contracts";
import { logAudit } from "./audit";
import { diffFields, nowIso } from "./_shared";

const localized = z.object({ en: z.string().trim().min(1, "required").max(200, "too_long"), tr: z.string().trim().max(200, "too_long") });
const cents = z.number({ error: "number_invalid" }).int("integer_required").min(0, "must_not_be_negative").max(10_000_000, "too_large");

const methodSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug_invalid")
      .max(40, "too_long"),
    name: localized,
    description: z.object({ en: z.string().trim().max(500, "too_long"), tr: z.string().trim().max(500, "too_long") }),
    countries: z.array(z.string().trim().toUpperCase().refine((c) => c === "*" || /^[A-Z]{2}$/.test(c), "country_invalid")).min(1, "required").max(250),
    price: cents,
    perKgPrice: cents,
    freeOverSubtotal: cents.optional(),
    estimatedDaysMin: z.number().int("integer_required").min(0, "must_not_be_negative").max(365, "too_large"),
    estimatedDaysMax: z.number().int("integer_required").min(0, "must_not_be_negative").max(365, "too_large"),
    isActive: z.boolean(),
    sortOrder: z.number().int("integer_required").min(0).max(10_000),
  })
  .refine((v) => v.estimatedDaysMax >= v.estimatedDaysMin, { message: "invalid_value", path: ["estimatedDaysMax"] });

function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new DomainError("validation_failed", { fieldErrors: zodFieldErrors(parsed.error) });
  return parsed.data;
}

type QuoteInput = { country: string; subtotal: Cents; totalWeightGrams: number; freeShippingCoupon?: boolean };

/** Pure pricing of one method for an order (exported through `_` helpers for tests). */
export function priceMethod(method: ShippingMethod, input: QuoteInput): ShippingQuote {
  const extraKg = Math.max(0, Math.floor(Math.max(0, input.totalWeightGrams) / 1000) - 1);
  let price = method.price + method.perKgPrice * extraKg;
  const freeByThreshold = method.freeOverSubtotal !== undefined && input.subtotal >= method.freeOverSubtotal;
  const isFree = Boolean(input.freeShippingCoupon) || freeByThreshold || price === 0;
  if (input.freeShippingCoupon || freeByThreshold) price = 0;
  return {
    methodId: method.id,
    code: method.code,
    name: method.name,
    description: method.description,
    price,
    isFree,
    estimatedDaysMin: method.estimatedDaysMin,
    estimatedDaysMax: method.estimatedDaysMax,
  };
}

export function methodServes(method: ShippingMethod, country: string): boolean {
  const c = country.trim().toUpperCase();
  return method.countries.some((x) => x === "*" || x.toUpperCase() === c);
}

export async function getQuotes(input: QuoteInput): Promise<ShippingQuote[]> {
  const methods = await db.shippingMethods.find({ where: (m) => m.isActive, orderBy: [{ field: "sortOrder", direction: "asc" }] });
  return methods.filter((m) => methodServes(m, input.country)).map((m) => priceMethod(m, input));
}

export async function getQuote(methodId: Id, input: QuoteInput): Promise<ShippingQuote> {
  const method = await db.shippingMethods.get(methodId);
  if (!method || !method.isActive || !methodServes(method, input.country)) throw new DomainError("shipping_unavailable", { status: 409 });
  return priceMethod(method, input);
}

export async function listShippingMethods(): Promise<ShippingMethod[]> {
  return db.shippingMethods.find({ orderBy: [{ field: "sortOrder", direction: "asc" }] });
}

export async function createShippingMethod(input: ShippingMethodInput, actor: Actor): Promise<ShippingMethod> {
  const data = parse(methodSchema, input);
  return db.transaction(async () => {
    if (await db.shippingMethods.findOne((m) => m.code === data.code)) throw new DomainError("code_taken", { status: 409 });
    const at = nowIso();
    const method = await db.shippingMethods.insert({ ...data, createdAt: at, updatedAt: at });
    await logAudit({ actor, action: "shipping.create", entityType: "shippingMethod", entityId: method.id, summary: `Created shipping method ${method.code}` });
    return method;
  });
}

export async function updateShippingMethod(id: Id, input: Partial<ShippingMethodInput>, actor: Actor): Promise<ShippingMethod> {
  return db.transaction(async () => {
    const current = await db.shippingMethods.get(id);
    if (!current) throw notFound("shipping method");
    const { id: _id, createdAt: _c, updatedAt: _u, ...editable } = current;
    void _id;
    void _c;
    void _u;
    const merged = parse(methodSchema, { ...editable, ...input });
    if (await db.shippingMethods.findOne((m) => m.id !== id && m.code === merged.code)) throw new DomainError("code_taken", { status: 409 });
    const patch: Partial<ShippingMethod> = { ...merged, updatedAt: nowIso() };
    if (merged.freeOverSubtotal === undefined) patch.freeOverSubtotal = undefined;
    const saved = await db.shippingMethods.update(id, patch);
    await logAudit({
      actor,
      action: "shipping.update",
      entityType: "shippingMethod",
      entityId: id,
      summary: `Updated shipping method ${saved.code}`,
      changes: diffFields(current, saved, ["code", "price", "perKgPrice", "freeOverSubtotal", "countries", "isActive", "estimatedDaysMin", "estimatedDaysMax"]),
    });
    return saved;
  });
}

export async function deleteShippingMethod(id: Id, actor: Actor): Promise<void> {
  await db.transaction(async () => {
    const current = await db.shippingMethods.get(id);
    if (!current) throw notFound("shipping method");
    await db.shippingMethods.delete(id);
    await logAudit({ actor, action: "shipping.delete", entityType: "shippingMethod", entityId: id, summary: `Deleted shipping method ${current.code}` });
  });
}
