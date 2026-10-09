"use client";

import { useState } from "react";
import { Controller, FormProvider, useForm, useFormContext, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { deleteCouponAction, saveCouponAction } from "@/actions/admin/coupons";
import { couponInputSchema, type CouponFormInput } from "@/actions/admin/coupons.schema";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, TableContainer, TableEmpty, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { localize, type LocalizedString } from "@/lib/i18n-string";
import { formatMoney } from "@/lib/money";
import { ConfirmActionButton } from "../common/ConfirmActionButton";
import { StatusBadge } from "../common/StatusBadge";
import { applyServerErrors, isoToDateInput } from "../forms/form-utils";
import { FormError, ModalFormActions } from "../forms/FormParts";
import { RhfInteger, RhfLocalized, RhfMoney, RhfSelect, RhfSwitch, RhfText } from "../forms/RhfFields";
import { useAdminAction } from "../forms/use-admin-action";
import { useFieldError } from "../forms/use-field-error";

export interface CouponRow {
  id: string;
  code: string;
  description: LocalizedString;
  type: "percent" | "fixed" | "free_shipping";
  value: number;
  minSubtotal?: number;
  maxDiscount?: number;
  startsAt?: string;
  endsAt?: string;
  usageLimit?: number;
  perUserLimit?: number;
  usedCount: number;
  categoryIds: string[];
  brandIds: string[];
  isActive: boolean;
  status: "active" | "scheduled" | "expired" | "disabled";
}

const couponFormSchema = z.object({ coupon: couponInputSchema });

function toValues(row: CouponRow | null): CouponFormInput {
  return {
    code: row?.code ?? "",
    description: row?.description ?? { en: "", tr: "" },
    type: row?.type ?? "percent",
    value: row?.value ?? 10,
    minSubtotal: row?.minSubtotal,
    maxDiscount: row?.maxDiscount,
    startsAt: isoToDateInput(row?.startsAt),
    endsAt: isoToDateInput(row?.endsAt),
    usageLimit: row?.usageLimit,
    perUserLimit: row?.perUserLimit,
    categoryIds: row?.categoryIds ?? [],
    brandIds: row?.brandIds ?? [],
    isActive: row?.isActive ?? true,
  };
}

export function CouponsManager({ rows, categories, brands, canWrite }: { rows: CouponRow[]; categories: { id: string; label: string }[]; brands: { id: string; name: string }[]; canWrite: boolean }) {
  const t = useTranslations("admin.coupons");
  const locale = useLocale();
  const [editing, setEditing] = useState<CouponRow | "new" | null>(null);

  const valueLabel = (r: CouponRow) => (r.type === "percent" ? `${r.value}%` : r.type === "fixed" ? formatMoney(r.value, locale) : t("freeShipping"));

  return (
    <div>
      {canWrite ? (
        <div className="mb-3 flex justify-end">
          <Button size="sm" leftIcon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
            {t("new")}
          </Button>
        </div>
      ) : null}
      <TableContainer>
        <Table dense caption={t("title")}>
          <THead>
            <Tr>
              <Th>{t("cols.code")}</Th>
              <Th>{t("cols.discount")}</Th>
              <Th>{t("cols.conditions")}</Th>
              <Th numeric>{t("cols.usage")}</Th>
              <Th>{t("cols.validity")}</Th>
              <Th>{t("cols.status")}</Th>
              {canWrite ? (
                <Th className="w-px">
                  <span className="sr-only">{t("cols.actions")}</span>
                </Th>
              ) : null}
            </Tr>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <TableEmpty colSpan={7}>{t("empty")}</TableEmpty>
            ) : (
              rows.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    <span className="num block font-medium tracking-wide">{r.code}</span>
                    <span className="block max-w-56 truncate text-xs text-muted">{localize(r.description, locale)}</span>
                  </Td>
                  <Td className="num">{valueLabel(r)}</Td>
                  <Td className="text-xs text-muted">
                    {r.minSubtotal ? <span className="block">{t("minSpend", { amount: formatMoney(r.minSubtotal, locale) })}</span> : null}
                    {r.maxDiscount ? <span className="block">{t("cap", { amount: formatMoney(r.maxDiscount, locale) })}</span> : null}
                    {r.categoryIds.length + r.brandIds.length > 0 ? <span className="block">{t("restricted")}</span> : null}
                    {!r.minSubtotal && !r.maxDiscount && r.categoryIds.length + r.brandIds.length === 0 ? "-" : null}
                  </Td>
                  <Td numeric>{r.usageLimit ? `${r.usedCount} / ${r.usageLimit}` : r.usedCount}</Td>
                  <Td className="num whitespace-nowrap text-xs text-muted">
                    {r.startsAt || r.endsAt ? `${isoToDateInput(r.startsAt) || "…"} → ${isoToDateInput(r.endsAt) || "…"}` : t("always")}
                  </Td>
                  <Td>
                    <StatusBadge kind="coupon" value={r.status} />
                  </Td>
                  {canWrite ? (
                    <Td>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label={t("edit", { code: r.code })} title={t("edit", { code: r.code })} onClick={() => setEditing(r)}>
                          <Pencil className="size-4" />
                        </Button>
                        <ConfirmActionButton
                          size="icon-sm"
                          aria-label={t("delete", { code: r.code })}
                          action={deleteCouponAction.bind(null, { id: r.id })}
                          title={t("deleteTitle", { code: r.code })}
                          description={t("deleteBody")}
                          confirmLabel={t("deleteConfirm")}
                          success={t("deleted")}
                        >
                          <Trash2 className="size-4" />
                        </ConfirmActionButton>
                      </div>
                    </Td>
                  ) : null}
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </TableContainer>
      <Modal open={editing !== null} onClose={() => setEditing(null)} size="xl" title={editing && editing !== "new" ? t("editTitle", { code: editing.code }) : t("newTitle")}>
        {editing ? <CouponForm key={editing === "new" ? "new" : editing.id} row={editing === "new" ? null : editing} categories={categories} brands={brands} onClose={() => setEditing(null)} /> : null}
      </Modal>
    </div>
  );
}

function CouponForm({ row, categories, brands, onClose }: { row: CouponRow | null; categories: { id: string; label: string }[]; brands: { id: string; name: string }[]; onClose: () => void }) {
  const t = useTranslations("admin.coupons.form");
  const { run, pending, errorText } = useAdminAction();
  const form = useForm<{ coupon: CouponFormInput }>({
    resolver: zodResolver(couponFormSchema) as unknown as Resolver<{ coupon: CouponFormInput }>,
    defaultValues: { coupon: toValues(row) },
  });
  const type = useWatch({ control: form.control, name: "coupon.type" });
  const fe = useFieldError(form.formState.errors);

  const submit = form.handleSubmit((values) =>
    run(() => saveCouponAction({ id: row?.id, coupon: values.coupon }), {
      success: t("saved"),
      toastError: false,
      onSuccess: onClose,
      onError: (failure) => applyServerErrors(form.setError, failure),
    }),
  );

  return (
    <FormProvider {...form}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError text={errorText} />
        <div className="grid gap-4 sm:grid-cols-2">
          <RhfText name="coupon.code" label={t("code")} hint={t("codeHint")} required autoComplete="off" className="font-mono uppercase" />
          <RhfSelect name="coupon.type" label={t("type")} required>
            <option value="percent">{t("types.percent")}</option>
            <option value="fixed">{t("types.fixed")}</option>
            <option value="free_shipping">{t("types.free_shipping")}</option>
          </RhfSelect>
          {type === "percent" ? <RhfInteger name="coupon.value" label={t("percent")} hint={t("percentHint")} required /> : null}
          {type === "fixed" ? <RhfMoney name="coupon.value" label={t("amount")} hint={t("usd")} required /> : null}
          {type === "percent" ? <RhfMoney name="coupon.maxDiscount" label={t("maxDiscount")} hint={t("maxDiscountHint")} /> : null}
          <RhfMoney name="coupon.minSubtotal" label={t("minSubtotal")} hint={t("minSubtotalHint")} />
          <RhfInteger name="coupon.usageLimit" label={t("usageLimit")} hint={t("unlimitedHint")} />
          <RhfInteger name="coupon.perUserLimit" label={t("perUserLimit")} hint={t("unlimitedHint")} />
          <Controller
            control={form.control}
            name="coupon.startsAt"
            render={({ field }) => (
              <Field label={t("startsAt")} hint={t("startsAtHint")} error={fe("coupon.startsAt")}>
                <Input size="sm" type="date" value={field.value} onChange={field.onChange} />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="coupon.endsAt"
            render={({ field }) => (
              <Field label={t("endsAt")} hint={t("endsAtHint")} error={fe("coupon.endsAt")}>
                <Input size="sm" type="date" value={field.value} onChange={field.onChange} />
              </Field>
            )}
          />
        </div>
        <RhfLocalized name="coupon.description" label={t("description")} />

        <fieldset className="rounded-md border border-border p-3">
          <legend className="px-1 text-sm font-medium">{t("appliesTo")}</legend>
          <p className="mb-2 text-[0.8125rem] text-muted">{t("appliesToHint")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <ScopeList name="coupon.categoryIds" title={t("categories")} options={categories.map((c) => ({ id: c.id, label: c.label }))} />
            <ScopeList name="coupon.brandIds" title={t("brands")} options={brands.map((b) => ({ id: b.id, label: b.name }))} />
          </div>
        </fieldset>
        <RhfSwitch name="coupon.isActive" label={t("active")} description={t("activeHint")} />
        <ModalFormActions pending={pending} onCancel={onClose} />
      </form>
    </FormProvider>
  );
}

function ScopeList({ name, title, options }: { name: "coupon.categoryIds" | "coupon.brandIds"; title: string; options: { id: string; label: string }[] }) {
  const { control } = useFormContext<{ coupon: CouponFormInput }>();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div>
          <p className="label-caps mb-1.5 text-muted">{title}</p>
          <ul className="max-h-44 space-y-1.5 overflow-y-auto rounded-sm border border-border p-2.5">
            {options.map((o) => (
              <li key={o.id}>
                <Checkbox
                  label={<span className="text-sm">{o.label}</span>}
                  checked={field.value.includes(o.id)}
                  onChange={(e) => field.onChange(e.target.checked ? [...field.value, o.id] : field.value.filter((id: string) => id !== o.id))}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    />
  );
}

