"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { AddressFields } from "@/components/account/forms/AddressFields";
import type { CountryOption } from "@/components/account/forms/regions";
import { Checkbox } from "@/components/ui";
import type { CheckoutFormValues } from "../form/checkout-form";

/** "Billing address is the same as delivery" toggle with the full address form when it is not. */
export function BillingSection({ countries }: { countries: CountryOption[] }) {
  const t = useTranslations("checkout.billing");
  const { control, register } = useFormContext<CheckoutFormValues>();
  const same = useWatch({ control, name: "billingSameAsShipping" });

  return (
    <div className="space-y-5">
      <Checkbox label={t("sameAsShipping")} {...register("billingSameAsShipping")} />
      {!same ? (
        <div className="space-y-4">
          <h3 className="display-4">{t("title")}</h3>
          <AddressFields prefix="billing." countries={countries} section="billing" />
        </div>
      ) : null}
    </div>
  );
}
