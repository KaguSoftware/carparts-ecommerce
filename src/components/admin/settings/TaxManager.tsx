"use client";

import { useState } from "react";
import { FormProvider, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { deleteTaxRateAction, saveTaxRateAction } from "@/actions/admin/shipping";
import { taxRateSchema, type TaxFormInput } from "@/actions/admin/shipping.schema";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Table, TableContainer, TableEmpty, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { localize, type LocalizedString } from "@/lib/i18n-string";
import { ConfirmActionButton } from "../common/ConfirmActionButton";
import { applyServerErrors } from "../forms/form-utils";
import { FormError, ModalFormActions } from "../forms/FormParts";
import { RhfCheckbox, RhfLocalized, RhfPercent, RhfSwitch, RhfText } from "../forms/RhfFields";
import { useAdminAction } from "../forms/use-admin-action";

export interface TaxRow {
  id: string;
  name: LocalizedString;
  country: string;
  region: string;
  rateBps: number;
  appliesToShipping: boolean;
  isActive: boolean;
}

const formSchema = z.object({ rate: taxRateSchema });

export function TaxManager({ rows }: { rows: TaxRow[] }) {
  const t = useTranslations("admin.tax");
  const locale = useLocale();
  const [editing, setEditing] = useState<TaxRow | "new" | null>(null);
  const percent = (bps: number) => new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", { style: "percent", maximumFractionDigits: 2 }).format(bps / 10_000);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" leftIcon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
          {t("new")}
        </Button>
      </div>
      <TableContainer>
        <Table dense caption={t("title")}>
          <THead>
            <Tr>
              <Th>{t("cols.name")}</Th>
              <Th>{t("cols.country")}</Th>
              <Th>{t("cols.region")}</Th>
              <Th numeric>{t("cols.rate")}</Th>
              <Th>{t("cols.shipping")}</Th>
              <Th>{t("cols.status")}</Th>
              <Th className="w-px">
                <span className="sr-only">{t("cols.actions")}</span>
              </Th>
            </Tr>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <TableEmpty colSpan={7}>{t("empty")}</TableEmpty>
            ) : (
              rows.map((r) => (
                <Tr key={r.id}>
                  <Td className="font-medium">{localize(r.name, locale)}</Td>
                  <Td className="num">{r.country}</Td>
                  <Td className="text-muted">{r.region || t("wholeCountry")}</Td>
                  <Td numeric className="font-medium">
                    {percent(r.rateBps)}
                  </Td>
                  <Td className="text-muted">{r.appliesToShipping ? t("taxed") : t("notTaxed")}</Td>
                  <Td>
                    <Badge tone={r.isActive ? "success" : "neutral"} dot>
                      {r.isActive ? t("active") : t("inactive")}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label={t("edit", { name: localize(r.name, locale) })} title={t("edit", { name: localize(r.name, locale) })} onClick={() => setEditing(r)}>
                        <Pencil className="size-4" />
                      </Button>
                      <ConfirmActionButton
                        size="icon-sm"
                        aria-label={t("delete", { name: localize(r.name, locale) })}
                        action={deleteTaxRateAction.bind(null, { id: r.id })}
                        title={t("deleteTitle", { name: localize(r.name, locale) })}
                        description={t("deleteBody")}
                        confirmLabel={t("deleteConfirm")}
                        success={t("deleted")}
                      >
                        <Trash2 className="size-4" />
                      </ConfirmActionButton>
                    </div>
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </TableContainer>
      <Modal open={editing !== null} onClose={() => setEditing(null)} size="lg" title={editing && editing !== "new" ? t("editTitle", { name: localize(editing.name, locale) }) : t("newTitle")}>
        {editing ? <TaxForm key={editing === "new" ? "new" : editing.id} row={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
      </Modal>
    </div>
  );
}

function TaxForm({ row, onClose }: { row: TaxRow | null; onClose: () => void }) {
  const t = useTranslations("admin.tax.form");
  const { run, pending, errorText } = useAdminAction();
  const form = useForm<{ rate: TaxFormInput }>({
    resolver: zodResolver(formSchema) as unknown as Resolver<{ rate: TaxFormInput }>,
    defaultValues: {
      rate: {
        name: row?.name ?? { en: "", tr: "" },
        country: row?.country ?? "US",
        region: row?.region ?? "",
        rateBps: (row?.rateBps ?? undefined) as number,
        appliesToShipping: row?.appliesToShipping ?? false,
        isActive: row?.isActive ?? true,
      },
    },
  });
  const submit = form.handleSubmit((values) =>
    run(() => saveTaxRateAction({ id: row?.id, rate: values.rate }), {
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
        <RhfLocalized name="rate.name" label={t("name")} required />
        <div className="grid gap-4 sm:grid-cols-3">
          <RhfText name="rate.country" label={t("country")} hint={t("countryHint")} required maxLength={2} autoComplete="off" />
          <RhfText name="rate.region" label={t("region")} hint={t("regionHint")} autoComplete="off" />
          <RhfPercent name="rate.rateBps" label={t("rate")} hint={t("rateHint")} required />
        </div>
        <RhfCheckbox name="rate.appliesToShipping" label={t("appliesToShipping")} description={t("appliesToShippingHint")} />
        <RhfSwitch name="rate.isActive" label={t("active")} />
        <ModalFormActions pending={pending} onCancel={onClose} />
      </form>
    </FormProvider>
  );
}
