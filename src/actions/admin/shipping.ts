"use server";

import { createShippingMethod, deleteShippingMethod, updateShippingMethod } from "@/lib/services/shipping";
import { createTaxRate, deleteTaxRate, updateTaxRate } from "@/lib/services/tax";
import type { ShippingMethodInput, TaxRateInput } from "@/lib/services/contracts";
import { adminAction, prefixFieldErrors, refresh } from "./_shared";
import { deleteByIdSchema, saveShippingSchema, saveTaxSchema } from "./shipping.schema";

export async function saveShippingMethodAction(raw: unknown) {
  return adminAction("settings.write", saveShippingSchema, raw, async ({ id, method }, { actor }) => {
    const input: ShippingMethodInput = {
      code: method.code,
      name: method.name,
      description: method.description,
      countries: [...new Set(method.countries)],
      price: method.price,
      perKgPrice: method.perKgPrice,
      ...(method.freeOverSubtotal ? { freeOverSubtotal: method.freeOverSubtotal } : {}),
      estimatedDaysMin: method.estimatedDaysMin,
      estimatedDaysMax: method.estimatedDaysMax,
      isActive: method.isActive,
      sortOrder: method.sortOrder,
    };
    const saved = id
      ? await updateShippingMethod(id, input, actor).catch((e) => prefixFieldErrors(e, "method"))
      : await createShippingMethod(input, actor).catch((e) => prefixFieldErrors(e, "method"));
    refresh(["/admin/shipping"], { store: true });
    return { id: saved.id };
  });
}

export async function deleteShippingMethodAction(raw: unknown) {
  return adminAction("settings.write", deleteByIdSchema, raw, async ({ id }, { actor }) => {
    await deleteShippingMethod(id, actor);
    refresh(["/admin/shipping"], { store: true });
  });
}

export async function saveTaxRateAction(raw: unknown) {
  return adminAction("settings.write", saveTaxSchema, raw, async ({ id, rate }, { actor }) => {
    const input: TaxRateInput = { ...rate };
    const saved = id
      ? await updateTaxRate(id, input, actor).catch((e) => prefixFieldErrors(e, "rate"))
      : await createTaxRate(input, actor).catch((e) => prefixFieldErrors(e, "rate"));
    refresh(["/admin/tax"], { store: true });
    return { id: saved.id };
  });
}

export async function deleteTaxRateAction(raw: unknown) {
  return adminAction("settings.write", deleteByIdSchema, raw, async ({ id }, { actor }) => {
    await deleteTaxRate(id, actor);
    refresh(["/admin/tax"], { store: true });
  });
}
