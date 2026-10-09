"use client";

import { Controller, useFormContext, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { CreditCard, Lock } from "lucide-react";
import { Alert, Field, Input } from "@/components/ui";
import { useErrorText } from "@/lib/hooks/use-error-text";
import { errorCode } from "@/components/account/forms/form-utils";
import { detectBrand, digitsOnly, formatCardNumber, formatExpiry } from "../form/card-utils";
import type { CheckoutFormValues } from "../form/checkout-form";
import { TestCards } from "./TestCards";

export function PaymentSection({ paymentError, showTestCards }: { paymentError: string | null; showTestCards: boolean }) {
  const t = useTranslations("checkout.payment");
  const { validation } = useErrorText();
  const { control, register, formState, setValue } = useFormContext<CheckoutFormValues>();
  const number = useWatch({ control, name: "card.number" }) ?? "";
  const brand = detectBrand(digitsOnly(number));
  const err = (name: string) => {
    const code = errorCode(formState.errors, name);
    return code ? validation(code) : undefined;
  };
  const isAmex = brand === "amex";

  return (
    <div className="space-y-5">
      {paymentError ? (
        <Alert tone="danger" title={t("failedTitle")} id="payment-error">
          {paymentError}
          <span className="mt-1 block text-sm">{t("failedHelp")}</span>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("cardNumber")} error={err("card.number")} required className="sm:col-span-2">
          {(a11y) => (
          <Controller
            control={control}
            name="card.number"
            render={({ field }) => (
              <Input
                {...field}
                {...a11y}
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="1234 1234 1234 1234"
                onChange={(e) => field.onChange(formatCardNumber(e.target.value))}
                leading={<CreditCard aria-hidden />}
                trailing={brand !== "card" ? <span className="label-caps pr-2 text-[0.6875rem] text-muted">{t(`brands.${brand}`)}</span> : undefined}
              />
            )}
          />
          )}
        </Field>

        <Field label={t("expiry")} error={err("card.expiry")} required>
          {(a11y) => (
          <Controller
            control={control}
            name="card.expiry"
            render={({ field }) => (
              <Input {...field} {...a11y} inputMode="numeric" autoComplete="cc-exp" placeholder={t("expiryPlaceholder")} maxLength={7} onChange={(e) => field.onChange(formatExpiry(e.target.value, field.value))} />
            )}
          />
          )}
        </Field>

        <Field label={t("cvc")} error={err("card.cvc")} hint={isAmex ? t("cvcHintAmex") : t("cvcHint")} required>
          {(a11y) => (
          <Controller
            control={control}
            name="card.cvc"
            render={({ field }) => (
              <Input {...field} {...a11y} inputMode="numeric" autoComplete="cc-csc" placeholder={isAmex ? "1234" : "123"} maxLength={4} onChange={(e) => field.onChange(digitsOnly(e.target.value).slice(0, 4))} />
            )}
          />
          )}
        </Field>

        <Field label={t("holder")} error={err("card.holder")} required className="sm:col-span-2">
          <Input autoComplete="cc-name" {...register("card.holder")} />
        </Field>
      </div>

      <p className="flex items-center gap-2 text-[0.8125rem] text-muted">
        <Lock className="size-3.5 shrink-0" aria-hidden />
        {t("secureNote")}
      </p>

      {showTestCards ? (
        <TestCards
          onUse={(cardNumber) => {
            setValue("card.number", formatCardNumber(cardNumber), { shouldDirty: true, shouldValidate: true });
            setValue("card.expiry", formatExpiry(String(((new Date().getUTCFullYear() + 3) % 100) + 1200)), { shouldDirty: true, shouldValidate: true });
            setValue("card.cvc", "123", { shouldDirty: true, shouldValidate: true });
          }}
        />
      ) : null}
    </div>
  );
}
