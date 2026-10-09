"use client";

import { useState } from "react";
import { FormProvider, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { deleteShippingMethodAction, saveShippingMethodAction } from "@/actions/admin/shipping";
import { shippingMethodSchema, type ShippingFormInput } from "@/actions/admin/shipping.schema";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Table, TableContainer, TableEmpty, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { localize, type LocalizedString } from "@/lib/i18n-string";
import { formatMoney } from "@/lib/money";
import { ConfirmActionButton } from "../common/ConfirmActionButton";
import { applyServerErrors } from "../forms/form-utils";
import { FormError, ModalFormActions } from "../forms/FormParts";
import { RhfInteger, RhfList, RhfLocalized, RhfMoney, RhfSwitch, RhfText } from "../forms/RhfFields";
import { useAdminAction } from "../forms/use-admin-action";

export interface ShippingRow {
  id: string;
  code: string;
  name: LocalizedString;
  description: LocalizedString;
  countries: string[];
  price: number;
  perKgPrice: number;
  freeOverSubtotal?: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  isActive: boolean;
  sortOrder: number;
}

const formSchema = z.object({ method: shippingMethodSchema });

function toValues(row: ShippingRow | null): ShippingFormInput {
  return {
    code: row?.code ?? "",
    name: row?.name ?? { en: "", tr: "" },
    description: row?.description ?? { en: "", tr: "" },
    countries: row?.countries ?? ["*"],
    price: (row?.price ?? undefined) as number,
    perKgPrice: row?.perKgPrice ?? 0,
    freeOverSubtotal: row?.freeOverSubtotal,
    estimatedDaysMin: row?.estimatedDaysMin ?? 2,
    estimatedDaysMax: row?.estimatedDaysMax ?? 5,
    isActive: row?.isActive ?? true,
    sortOrder: row?.sortOrder ?? 0,
  };
}

export function ShippingManager({ rows }: { rows: ShippingRow[] }) {
  const t = useTranslations("admin.shipping");
  const locale = useLocale();
  const [editing, setEditing] = useState<ShippingRow | "new" | null>(null);
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
              <Th>{t("cols.method")}</Th>
              <Th>{t("cols.countries")}</Th>
              <Th numeric>{t("cols.rate")}</Th>
              <Th numeric>{t("cols.freeOver")}</Th>
              <Th>{t("cols.delivery")}</Th>
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
                  <Td>
                    <span className="block font-medium">{localize(r.name, locale)}</span>
                    <span className="num block text-xs text-muted">{r.code}</span>
                  </Td>
                  <Td className="max-w-48 truncate text-muted">{r.countries.includes("*") ? t("everywhere") : r.countries.join(", ")}</Td>
                  <Td numeric>
                    {formatMoney(r.price, locale)}
                    {r.perKgPrice > 0 ? <span className="block text-xs text-muted">{t("perKg", { amount: formatMoney(r.perKgPrice, locale) })}</span> : null}
                  </Td>
                  <Td numeric className="text-muted">
                    {r.freeOverSubtotal ? formatMoney(r.freeOverSubtotal, locale) : "-"}
                  </Td>
                  <Td className="num text-muted">{t("days", { min: r.estimatedDaysMin, max: r.estimatedDaysMax })}</Td>
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
                        action={deleteShippingMethodAction.bind(null, { id: r.id })}
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
      <Modal open={editing !== null} onClose={() => setEditing(null)} size="xl" title={editing && editing !== "new" ? t("editTitle", { name: localize(editing.name, locale) }) : t("newTitle")}>
        {editing ? <ShippingForm key={editing === "new" ? "new" : editing.id} row={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
      </Modal>
    </div>
  );
}

function ShippingForm({ row, onClose }: { row: ShippingRow | null; onClose: () => void }) {
  const t = useTranslations("admin.shipping.form");
  const { run, pending, errorText } = useAdminAction();
  const form = useForm<{ method: ShippingFormInput }>({ resolver: zodResolver(formSchema) as unknown as Resolver<{ method: ShippingFormInput }>, defaultValues: { method: toValues(row) } });
  const submit = form.handleSubmit((values) =>
    run(() => saveShippingMethodAction({ id: row?.id, method: values.method }), {
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
          <RhfText name="method.code" label={t("code")} hint={t("codeHint")} required className="font-mono" autoComplete="off" />
          <RhfInteger name="method.sortOrder" label={t("sortOrder")} />
        </div>
        <RhfLocalized name="method.name" label={t("name")} required />
        <RhfLocalized name="method.description" label={t("description")} />
        <RhfList name="method.countries" label={t("countries")} hint={t("countriesHint")} required />
        <div className="grid gap-4 sm:grid-cols-3">
          <RhfMoney name="method.price" label={t("price")} hint={t("usd")} required />
          <RhfMoney name="method.perKgPrice" label={t("perKgPrice")} hint={t("perKgHint")} />
          <RhfMoney name="method.freeOverSubtotal" label={t("freeOver")} hint={t("freeOverHint")} />
          <RhfInteger name="method.estimatedDaysMin" label={t("daysMin")} />
          <RhfInteger name="method.estimatedDaysMax" label={t("daysMax")} />
        </div>
        <RhfSwitch name="method.isActive" label={t("active")} description={t("activeHint")} />
        <ModalFormActions pending={pending} onCancel={onClose} />
      </form>
    </FormProvider>
  );
}
