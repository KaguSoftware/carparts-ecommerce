"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { AddressFields } from "@/components/account/forms/AddressFields";
import type { CountryOption } from "@/components/account/forms/regions";
import { AddressBlock } from "@/components/checkout/order/AddressBlock";
import { Checkbox } from "@/components/ui";
import type { Address } from "@/lib/types/domain";
import { cn } from "@/lib/utils";
import { addressToFormValues, EMPTY_ADDRESS, type CheckoutFormValues } from "../form/checkout-form";

export interface ShippingAddressSectionProps {
  savedAddresses: Address[];
  countries: CountryOption[];
  defaultCountry: string;
  locale: string;
  isGuest: boolean;
}

/** Delivery address: pick a saved one (signed-in customers) or type a new one. Country / region drive shipping + tax quotes. */
export function ShippingAddressSection({ savedAddresses, countries, defaultCountry, locale, isGuest }: ShippingAddressSectionProps) {
  const t = useTranslations("checkout.shipping");
  const { control, register, setValue } = useFormContext<CheckoutFormValues>();
  const savedId = useWatch({ control, name: "savedAddressId" });
  const usingSaved = savedId !== "";

  function choose(address: Address | null) {
    if (address) {
      setValue("savedAddressId", address.id, { shouldDirty: true });
      setValue("shipping", addressToFormValues(address), { shouldDirty: true, shouldValidate: true });
    } else {
      setValue("savedAddressId", "", { shouldDirty: true });
      setValue("shipping", { ...EMPTY_ADDRESS, country: defaultCountry }, { shouldDirty: true });
    }
  }

  return (
    <div className="space-y-5">
      {!isGuest && savedAddresses.length > 0 ? (
        <fieldset className="space-y-3">
          <legend className="mb-1 text-sm font-medium">{t("savedAddresses")}</legend>
          {savedAddresses.map((address) => {
            const checked = savedId === address.id;
            return (
              <label key={address.id} className={cn("flex cursor-pointer items-start gap-3.5 rounded-md border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus", checked ? "border-primary bg-primary-soft" : "border-border-strong hover:border-muted")}>
                <input type="radio" name="savedAddress" checked={checked} onChange={() => choose(address)} className="mt-1 size-4.5 accent-primary" />
                <span className="min-w-0 flex-1">
                  {address.label ? <span className="label-caps mb-1 block text-muted">{address.label}</span> : null}
                  <AddressBlock address={address} locale={locale} />
                </span>
              </label>
            );
          })}
          <label className={cn("flex cursor-pointer items-center gap-3.5 rounded-md border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus", !usingSaved ? "border-primary bg-primary-soft" : "border-border-strong hover:border-muted")}>
            <input type="radio" name="savedAddress" checked={!usingSaved} onChange={() => choose(null)} className="size-4.5 accent-primary" />
            <span className="font-medium">{t("useNew")}</span>
          </label>
        </fieldset>
      ) : null}

      {!usingSaved ? (
        <>
          <AddressFields prefix="shipping." countries={countries} section="shipping" />
          {!isGuest ? <Checkbox label={t("saveAddress")} {...register("saveAddress")} /> : null}
        </>
      ) : null}
    </div>
  );
}
