"use client";

import { useState } from "react";
import { Controller, FormProvider, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { Boxes, Pencil, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { deleteVariantAction, saveVariantAction } from "@/actions/admin/products";
import { variantInputSchema, type VariantFormInput } from "@/actions/admin/products.schema";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { localize, type LocalizedString } from "@/lib/i18n-string";
import { formatMoney } from "@/lib/money";
import { ConfirmActionButton } from "../common/ConfirmActionButton";
import { StatusBadge } from "../common/StatusBadge";
import { applyServerErrors } from "../forms/form-utils";
import { FormError } from "../forms/FormParts";
import { PairsEditor } from "../forms/PairsEditor";
import { RhfCheckbox, RhfInteger, RhfLocalized, RhfMoney, RhfSelect, RhfText } from "../forms/RhfFields";
import { useAdminAction } from "../forms/use-admin-action";
import { StockAdjustDialog, type StockTarget } from "../inventory/StockAdjustDialog";

export interface VariantRow {
  id: string;
  sku: string;
  name: LocalizedString;
  options: { name: LocalizedString; value: LocalizedString }[];
  price: number;
  compareAtPrice?: number;
  cost?: number;
  stockOnHand: number;
  stockReserved: number;
  lowStockThreshold: number;
  weightGrams: number;
  barcode?: string;
  imageId?: string;
  isActive: boolean;
  isDefault: boolean;
  stockStatus: "in_stock" | "low_stock" | "out_of_stock";
}

export interface VariantsManagerProps {
  productId: string;
  variants: VariantRow[];
  images: { id: string; alt: LocalizedString; url: string }[];
  defaultLowStockThreshold: number;
  canWrite: boolean;
  canAdjustStock: boolean;
}

function toFormValues(v: VariantRow | null, threshold: number): VariantFormInput {
  return {
    sku: v?.sku ?? "",
    name: v?.name ?? { en: "", tr: "" },
    options: v?.options ?? [],
    price: (v?.price ?? undefined) as number,
    compareAtPrice: v?.compareAtPrice,
    cost: v?.cost,
    initialStock: 0,
    lowStockThreshold: v?.lowStockThreshold ?? threshold,
    weightGrams: v?.weightGrams ?? 0,
    barcode: v?.barcode ?? "",
    imageId: v?.imageId ?? "",
    isActive: v?.isActive ?? true,
    isDefault: v?.isDefault ?? false,
  };
}

export function VariantsManager({ productId, variants, images, defaultLowStockThreshold, canWrite, canAdjustStock }: VariantsManagerProps) {
  const t = useTranslations("admin.products.variants");
  const locale = useLocale();
  const [editing, setEditing] = useState<VariantRow | "new" | null>(null);
  const [stockTarget, setStockTarget] = useState<StockTarget | null>(null);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{t("intro")}</p>
        {canWrite ? (
          <Button size="sm" leftIcon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
            {t("add")}
          </Button>
        ) : null}
      </div>

      <TableContainer>
        <Table caption={t("title")} dense>
          <THead>
            <Tr>
              <Th>{t("cols.sku")}</Th>
              <Th>{t("cols.name")}</Th>
              <Th numeric>{t("cols.price")}</Th>
              <Th numeric>{t("cols.cost")}</Th>
              <Th numeric>{t("cols.stock")}</Th>
              <Th>{t("cols.status")}</Th>
              <Th className="w-px">
                <span className="sr-only">{t("cols.actions")}</span>
              </Th>
            </Tr>
          </THead>
          <TBody>
            {variants.map((v) => (
              <Tr key={v.id}>
                <Td className="num font-medium">{v.sku}</Td>
                <Td>
                  <span className="block">{localize(v.name, locale)}</span>
                  {v.options.length > 0 ? <span className="block text-xs text-muted">{v.options.map((o) => `${localize(o.name, locale)}: ${localize(o.value, locale)}`).join(" / ")}</span> : null}
                </Td>
                <Td numeric>
                  {formatMoney(v.price, locale)}
                  {v.compareAtPrice ? <s className="block text-xs text-muted">{formatMoney(v.compareAtPrice, locale)}</s> : null}
                </Td>
                <Td numeric className="text-muted">
                  {v.cost ? formatMoney(v.cost, locale) : "-"}
                </Td>
                <Td numeric>
                  <span title={t("stockTitle", { onHand: v.stockOnHand, reserved: v.stockReserved })}>{Math.max(0, v.stockOnHand - v.stockReserved)}</span>
                  <span className="block text-xs text-muted">{t("onHandReserved", { onHand: v.stockOnHand, reserved: v.stockReserved })}</span>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    <StatusBadge kind="stock" value={v.stockStatus} />
                    {v.isDefault ? <Badge tone="outline">{t("default")}</Badge> : null}
                    {!v.isActive ? <Badge tone="neutral">{t("inactive")}</Badge> : null}
                  </div>
                </Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    {canAdjustStock ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("adjustStock", { sku: v.sku })}
                        title={t("adjustStock", { sku: v.sku })}
                        onClick={() => setStockTarget({ variantId: v.id, sku: v.sku, label: localize(v.name, locale), onHand: v.stockOnHand, reserved: v.stockReserved })}
                      >
                        <Boxes className="size-4" />
                      </Button>
                    ) : null}
                    {canWrite ? (
                      <>
                        <Button variant="ghost" size="icon-sm" aria-label={t("edit", { sku: v.sku })} title={t("edit", { sku: v.sku })} onClick={() => setEditing(v)}>
                          <Pencil className="size-4" />
                        </Button>
                        <ConfirmActionButton
                          size="icon-sm"
                          aria-label={t("delete", { sku: v.sku })}
                          action={deleteVariantAction.bind(null, { variantId: v.id })}
                          title={t("deleteTitle", { sku: v.sku })}
                          description={t("deleteBody")}
                          confirmLabel={t("deleteConfirm")}
                          success={t("deleted")}
                          disabled={variants.length <= 1}
                        >
                          <Trash2 className="size-4" />
                        </ConfirmActionButton>
                      </>
                    ) : null}
                  </div>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableContainer>

      <Modal open={editing !== null} onClose={() => setEditing(null)} size="xl" title={editing === "new" ? t("addTitle") : t("editTitle", { sku: editing?.sku ?? "" })} footer={<VariantFooter onClose={() => setEditing(null)} />}>
        {editing !== null ? (
          <VariantForm
            key={editing === "new" ? "new" : editing.id}
            productId={productId}
            variant={editing === "new" ? null : editing}
            images={images}
            defaultLowStockThreshold={defaultLowStockThreshold}
            onSaved={() => setEditing(null)}
          />
        ) : null}
      </Modal>
      <StockAdjustDialog target={stockTarget} onClose={() => setStockTarget(null)} />
    </div>
  );
}

const FORM_ID = "variant-form";
const formSchema = z.object({ variant: variantInputSchema });

function VariantFooter({ onClose }: { onClose: () => void }) {
  const tc = useTranslations("admin.common");
  return (
    <>
      <Button type="button" variant="ghost" onClick={onClose}>
        {tc("cancel")}
      </Button>
      <Button type="submit" form={FORM_ID}>
        {tc("save")}
      </Button>
    </>
  );
}

function VariantForm({ productId, variant, images, defaultLowStockThreshold, onSaved }: { productId: string; variant: VariantRow | null; images: VariantsManagerProps["images"]; defaultLowStockThreshold: number; onSaved: () => void }) {
  const t = useTranslations("admin.products.variants");
  const locale = useLocale();
  const { run, errorText } = useAdminAction();
  const form = useForm<{ variant: VariantFormInput }>({
    resolver: zodResolver(formSchema) as unknown as Resolver<{ variant: VariantFormInput }>,
    defaultValues: { variant: toFormValues(variant, defaultLowStockThreshold) },
  });
  const creating = variant === null;

  const submit = form.handleSubmit((values) =>
    run(() => saveVariantAction({ productId, variantId: variant?.id, variant: values.variant }), {
      success: t("saved"),
      toastError: false,
      onSuccess: onSaved,
      onError: (failure) => applyServerErrors(form.setError, failure),
    }),
  );

  return (
    <FormProvider {...form}>
      <form id={FORM_ID} onSubmit={submit} noValidate className="space-y-4">
        <FormError text={errorText} />
        <div className="grid gap-4 sm:grid-cols-2">
          <RhfText name="variant.sku" label={t("form.sku")} required autoComplete="off" className="font-mono" />
          <RhfText name="variant.barcode" label={t("form.barcode")} />
        </div>
        <RhfLocalized name="variant.name" label={t("form.name")} required />
        <div className="grid gap-4 sm:grid-cols-3">
          <RhfMoney name="variant.price" label={t("form.price")} required hint={t("form.usd")} />
          <RhfMoney name="variant.compareAtPrice" label={t("form.compareAt")} hint={t("form.compareAtHint")} />
          <RhfMoney name="variant.cost" label={t("form.cost")} hint={t("form.costHint")} />
          {creating ? <RhfInteger name="variant.initialStock" label={t("form.initialStock")} /> : null}
          <RhfInteger name="variant.lowStockThreshold" label={t("form.lowStock")} />
          <RhfInteger name="variant.weightGrams" label={t("form.weight")} hint={t("form.grams")} />
        </div>
        {images.length > 0 ? (
          <RhfSelect name="variant.imageId" label={t("form.image")} hint={t("form.imageHint")}>
            <option value="">{t("form.noImage")}</option>
            {images.map((image, index) => (
              <option key={image.id} value={image.id}>
                {`${index + 1}. ${localize(image.alt, locale) || image.url.split("/").pop()}`}
              </option>
            ))}
          </RhfSelect>
        ) : null}
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <RhfCheckbox name="variant.isActive" label={t("form.active")} description={t("form.activeHint")} />
          <RhfCheckbox name="variant.isDefault" label={t("form.default")} description={t("form.defaultHint")} />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">{t("form.options")}</p>
          <p className="mb-2 text-[0.8125rem] text-muted">{t("form.optionsHint")}</p>
          <Controller
            control={form.control}
            name="variant.options"
            render={({ field }) => (
              <PairsEditor
                field="name"
                max={8}
                value={field.value}
                onChange={field.onChange}
                labels={{ key: t("form.optionName"), value: t("form.optionValue"), add: t("form.addOption"), remove: t("form.removeOption"), empty: t("form.noOptions") }}
              />
            )}
          />
        </div>
      </form>
    </FormProvider>
  );
}
