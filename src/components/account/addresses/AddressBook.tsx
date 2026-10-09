"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FormProvider, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import type { z } from "zod";
import { deleteAddressAction, saveAddressAction, setDefaultAddressAction } from "@/actions/account/addresses";
import { saveAddressSchema } from "@/actions/account/addresses.schema";
import { AddressBlock } from "@/components/checkout/order/AddressBlock";
import { Alert, Badge, Button, Checkbox, Field, Input, Modal, useToast } from "@/components/ui";
import { useErrorText } from "@/lib/hooks/use-error-text";
import type { Address } from "@/lib/types/domain";
import { AddressFields } from "../forms/AddressFields";
import { applyServerFieldErrors, errorCode } from "../forms/form-utils";
import { regionOptions, type CountryOption } from "../forms/regions";
import { useRouter } from "@/i18n/navigation";

type AddressFormValues = z.input<typeof saveAddressSchema>;

const addressFormSchema = saveAddressSchema.superRefine((value, ctx) => {
  if (regionOptions(value.country) && !value.region) ctx.addIssue({ code: "custom", path: ["region"], message: "required" });
});

const EMPTY: AddressFormValues = {
  label: "",
  firstName: "",
  lastName: "",
  company: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
  phone: "",
  isDefaultShipping: false,
  isDefaultBilling: false,
};

function toFormValues(address: Address): AddressFormValues {
  return {
    id: address.id,
    label: address.label ?? "",
    firstName: address.firstName,
    lastName: address.lastName,
    company: address.company ?? "",
    line1: address.line1,
    line2: address.line2 ?? "",
    city: address.city,
    region: address.region,
    postalCode: address.postalCode,
    country: address.country,
    phone: address.phone,
    isDefaultShipping: address.isDefaultShipping,
    isDefaultBilling: address.isDefaultBilling,
  };
}

export function AddressBook({ addresses, countries, defaultCountry, maxAddresses = 20 }: { addresses: Address[]; countries: CountryOption[]; defaultCountry: string; maxAddresses?: number }) {
  const t = useTranslations("account.addresses");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const { actionError } = useErrorText();
  const [editing, setEditing] = useState<AddressFormValues | null>(null);
  const [removing, setRemoving] = useState<Address | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function markDefault(address: Address, kind: "shipping" | "billing") {
    setBusyId(`${address.id}:${kind}`);
    startTransition(async () => {
      const result = await setDefaultAddressAction({ id: address.id, kind });
      setBusyId(null);
      if (!result.ok) toast.error(actionError(result));
      else {
        toast.success(kind === "shipping" ? t("defaultShippingSet") : t("defaultBillingSet"));
        router.refresh();
      }
    });
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusyId(`${removing.id}:delete`);
    setRemoveError(null);
    const result = await deleteAddressAction({ id: removing.id });
    setBusyId(null);
    if (!result.ok) {
      setRemoveError(actionError(result));
      return;
    }
    setRemoving(null);
    toast.success(t("deleted"));
    router.refresh();
  }

  const atLimit = addresses.length >= maxAddresses;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">
          {t("count", { count: addresses.length })}
        </p>
        <Button onClick={() => setEditing({ ...EMPTY, country: defaultCountry })} disabled={atLimit} leftIcon={<Plus className="size-4" aria-hidden />}>
          {t("add")}
        </Button>
      </div>
      {atLimit ? <Alert tone="info" className="mb-6">{t("limitReached", { max: maxAddresses })}</Alert> : null}

      {addresses.length === 0 ? (
        <div className="rounded-md border border-dashed border-border-strong px-6 py-14 text-center">
          <MapPin className="mx-auto size-8 text-subtle" aria-hidden />
          <p className="display-4 mt-3">{t("emptyTitle")}</p>
          <p className="mx-auto mt-2 max-w-sm text-muted">{t("emptyBody")}</p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id} className="flex flex-col rounded-md border border-border bg-surface p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-bold uppercase tracking-wide">{address.label || t("untitled")}</h2>
                {address.isDefaultShipping ? <Badge tone="primary">{t("defaultShipping")}</Badge> : null}
                {address.isDefaultBilling ? <Badge tone="neutral">{t("defaultBilling")}</Badge> : null}
              </div>
              <AddressBlock address={address} locale={locale} />
              <div className="mt-auto flex flex-wrap items-center gap-x-1 gap-y-1 pt-5">
                <Button size="sm" variant="outline" onClick={() => setEditing(toFormValues(address))} leftIcon={<Pencil className="size-3.5" aria-hidden />}>
                  {t("edit")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setRemoveError(null); setRemoving(address); }} leftIcon={<Trash2 className="size-3.5" aria-hidden />}>
                  {t("delete")}
                </Button>
              </div>
              {!address.isDefaultShipping || !address.isDefaultBilling ? (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-sm">
                  {!address.isDefaultShipping ? (
                    <button type="button" className="font-medium text-primary-text underline-offset-4 hover:underline disabled:opacity-50" disabled={busyId === `${address.id}:shipping`} onClick={() => markDefault(address, "shipping")}>
                      {t("makeDefaultShipping")}
                    </button>
                  ) : null}
                  {!address.isDefaultBilling ? (
                    <button type="button" className="font-medium text-primary-text underline-offset-4 hover:underline disabled:opacity-50" disabled={busyId === `${address.id}:billing`} onClick={() => markDefault(address, "billing")}>
                      {t("makeDefaultBilling")}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {editing ? <AddressDialog key={editing.id ?? "new"} initial={editing} countries={countries} onClose={() => setEditing(null)} /> : null}

      <Modal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={t("deleteTitle")}
        description={t("deleteBody")}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              {t("cancel")}
            </Button>
            <Button variant="danger" onClick={confirmRemove} loading={busyId === `${removing?.id}:delete`}>
              {t("deleteConfirm")}
            </Button>
          </>
        }
      >
        {removeError ? <Alert tone="danger">{removeError}</Alert> : null}
        {removing ? <AddressBlock address={removing} locale={locale} /> : null}
      </Modal>
    </>
  );
}

function AddressDialog({ initial, countries, onClose }: { initial: AddressFormValues; countries: CountryOption[]; onClose: () => void }) {
  const t = useTranslations("account.addresses");
  const router = useRouter();
  const toast = useToast();
  const { validation, actionError } = useErrorText();
  const [formError, setFormError] = useState<string | null>(null);
  const isNew = !initial.id;

  const form = useForm<AddressFormValues>({
    resolver: zodResolver(addressFormSchema) as unknown as Resolver<AddressFormValues>,
    defaultValues: initial,
    mode: "onTouched",
  });
  const { register, handleSubmit, formState } = form;
  const labelError = errorCode(formState.errors, "label");

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await saveAddressAction(values);
    if (result.ok) {
      toast.success(isNew ? t("created") : t("updated"));
      router.refresh();
      onClose();
      return;
    }
    const unmapped = applyServerFieldErrors(form, result.fieldErrors);
    if (unmapped.length > 0 || !result.fieldErrors) setFormError(actionError(result));
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={isNew ? t("addTitle") : t("editTitle")}
      dismissible={!formState.isSubmitting}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={formState.isSubmitting}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="address-form" loading={formState.isSubmitting}>
            {t("save")}
          </Button>
        </>
      }
    >
      <FormProvider {...form}>
        <form id="address-form" onSubmit={onSubmit} noValidate className="space-y-5">
          {formError ? <Alert tone="danger">{formError}</Alert> : null}
          <Field label={t("fields.label")} hint={t("fields.labelHint")} error={labelError ? validation(labelError) : undefined} optional>
            <Input maxLength={40} {...register("label")} />
          </Field>
          <AddressFields countries={countries} />
          <div className="space-y-3 border-t border-border pt-4">
            <Checkbox label={t("fields.defaultShipping")} {...register("isDefaultShipping")} />
            <Checkbox label={t("fields.defaultBilling")} {...register("isDefaultBilling")} />
          </div>
        </form>
      </FormProvider>
    </Modal>
  );
}
