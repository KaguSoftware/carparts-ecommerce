"use server";

import { updateSettings } from "@/lib/services/settings";
import { adminAction, refresh } from "./_shared";
import { settingsFormSchema } from "./settings.schema";

/** Saves the whole settings form. The service re-validates and writes one audit entry with the field diffs. */
export async function updateSettingsAction(raw: unknown) {
  return adminAction("settings.write", settingsFormSchema, raw, async (values, { actor }) => {
    await updateSettings(
      {
        store: { ...values.store, ...(values.store.taxId ? {} : { taxId: undefined }) },
        currency: { base: "USD", tryPerUsd: values.currency.tryPerUsd },
        checkout: values.checkout,
        inventory: values.inventory,
        seo: values.seo,
        social: values.social,
        maintenanceMode: values.maintenanceMode,
        emails: values.emails,
      },
      actor,
    );
    refresh(["/admin/settings", "/admin"], { store: true });
  });
}
