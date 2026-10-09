"use client";

import { FormProvider, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { updateSettingsAction } from "@/actions/admin/settings";
import { settingsFormSchema, type SettingsFormInput } from "@/actions/admin/settings.schema";
import { applyServerErrors } from "../forms/form-utils";
import { FormError, FormFooter, FormSection } from "../forms/FormParts";
import { RhfInteger, RhfList, RhfLocalized, RhfMoney, RhfNumber, RhfSwitch, RhfText } from "../forms/RhfFields";
import { useAdminAction } from "../forms/use-admin-action";

export function SettingsForm({ initial }: { initial: SettingsFormInput }) {
  const t = useTranslations("admin.settings");
  const { run, pending, errorText } = useAdminAction();
  const form = useForm<SettingsFormInput>({ resolver: zodResolver(settingsFormSchema) as unknown as Resolver<SettingsFormInput>, defaultValues: initial });

  const submit = form.handleSubmit((values) =>
    run(() => updateSettingsAction(values), {
      success: t("saved"),
      toastError: false,
      onSuccess: () => form.reset(values),
      onError: (failure) => applyServerErrors(form.setError, failure),
    }),
  );

  return (
    <FormProvider {...form}>
      <form onSubmit={submit} noValidate>
        <FormError text={errorText} />
        <div className="grid gap-4 xl:grid-cols-2">
          <FormSection title={t("store.title")} description={t("store.description")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <RhfText name="store.name" label={t("store.name")} required />
              <RhfText name="store.legalEntity" label={t("store.legalEntity")} />
              <RhfText name="store.email" label={t("store.email")} type="email" required />
              <RhfText name="store.phone" label={t("store.phone")} />
              <RhfText name="store.taxId" label={t("store.taxId")} hint={t("store.taxIdHint")} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <RhfText name="store.address.line1" label={t("store.line1")} className="sm:col-span-2" />
              <RhfText name="store.address.city" label={t("store.city")} />
              <RhfText name="store.address.region" label={t("store.region")} />
              <RhfText name="store.address.postalCode" label={t("store.postalCode")} />
              <RhfText name="store.address.country" label={t("store.country")} hint={t("countryHint")} maxLength={2} required />
            </div>
          </FormSection>

          <div className="space-y-4">
            <FormSection title={t("currency.title")} description={t("currency.description")}>
              <RhfNumber name="currency.tryPerUsd" label={t("currency.rate")} hint={t("currency.rateHint")} required min={0} />
            </FormSection>

            <FormSection title={t("inventory.title")}>
              <RhfInteger name="inventory.defaultLowStockThreshold" label={t("inventory.threshold")} hint={t("inventory.thresholdHint")} />
              <RhfSwitch name="inventory.allowBackorders" label={t("inventory.backorders")} description={t("inventory.backordersHint")} />
            </FormSection>
          </div>

          <FormSection title={t("checkout.title")} description={t("checkout.description")}>
            <RhfSwitch name="checkout.guestCheckout" label={t("checkout.guest")} description={t("checkout.guestHint")} />
            <div className="grid gap-4 sm:grid-cols-2">
              <RhfText name="checkout.orderNumberPrefix" label={t("checkout.prefix")} hint={t("checkout.prefixHint")} maxLength={8} className="font-mono" />
              <RhfInteger name="checkout.maxQuantityPerLine" label={t("checkout.maxQty")} />
              <RhfMoney name="checkout.freeShippingThreshold" label={t("checkout.freeShipping")} hint={t("checkout.freeShippingHint")} />
              <RhfInteger name="checkout.reservationMinutes" label={t("checkout.reservation")} hint={t("checkout.reservationHint")} />
              <RhfText name="checkout.defaultCountry" label={t("checkout.defaultCountry")} maxLength={2} required />
            </div>
            <RhfList name="checkout.shippableCountries" label={t("checkout.shippable")} hint={t("checkout.shippableHint")} required />
          </FormSection>

          <FormSection title={t("seo.title")} description={t("seo.description")}>
            <RhfLocalized name="seo.defaultTitle" label={t("seo.defaultTitle")} />
            <RhfLocalized name="seo.defaultDescription" label={t("seo.defaultDescription")} multiline rows={3} />
          </FormSection>

          <FormSection title={t("social.title")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <RhfText name="social.instagram" label="Instagram" type="url" placeholder="https://" />
              <RhfText name="social.youtube" label="YouTube" type="url" placeholder="https://" />
              <RhfText name="social.x" label="X" type="url" placeholder="https://" />
              <RhfText name="social.facebook" label="Facebook" type="url" placeholder="https://" />
            </div>
          </FormSection>

          <FormSection title={t("emails.title")} description={t("emails.description")}>
            <RhfSwitch name="emails.orderConfirmation" label={t("emails.orderConfirmation")} />
            <RhfSwitch name="emails.shippingUpdate" label={t("emails.shippingUpdate")} />
            <RhfSwitch name="emails.adminNewOrder" label={t("emails.adminNewOrder")} />
            <RhfText name="emails.adminAddress" label={t("emails.adminAddress")} type="email" hint={t("emails.adminAddressHint")} />
          </FormSection>

          <FormSection title={t("maintenance.title")}>
            <RhfSwitch name="maintenanceMode" label={t("maintenance.label")} description={t("maintenance.hint")} />
          </FormSection>
        </div>
        <FormFooter pending={pending} />
      </form>
    </FormProvider>
  );
}
