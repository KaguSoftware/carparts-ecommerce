"use client";

import { useState } from "react";
import Link from "next/link";
import { Controller, FormProvider, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { deleteBrandAction, saveBrandAction } from "@/actions/admin/taxonomy";
import { brandInputSchema, type BrandFormInput } from "@/actions/admin/taxonomy.schema";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Table, TableContainer, TableEmpty, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import type { LocalizedString } from "@/lib/i18n-string";
import { ConfirmActionButton } from "../common/ConfirmActionButton";
import { applyServerErrors } from "../forms/form-utils";
import { FormError, ModalFormActions } from "../forms/FormParts";
import { ImageUploadField } from "../forms/ImageUpload";
import { RhfInteger, RhfLocalized, RhfSwitch, RhfText } from "../forms/RhfFields";
import { useAdminAction } from "../forms/use-admin-action";

export interface BrandRow {
  id: string;
  slug: string;
  name: string;
  description: LocalizedString;
  logo?: string;
  country?: string;
  website?: string;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  productCount: number;
}

const formSchema = z.object({ brand: brandInputSchema });
type Values = { brand: BrandFormInput };

export function BrandsManager({ rows, canWrite }: { rows: BrandRow[]; canWrite: boolean }) {
  const t = useTranslations("admin.brands");
  const [editing, setEditing] = useState<BrandRow | "new" | null>(null);

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
              <Th>{t("cols.name")}</Th>
              <Th>{t("cols.slug")}</Th>
              <Th>{t("cols.country")}</Th>
              <Th numeric>{t("cols.products")}</Th>
              <Th numeric>{t("cols.order")}</Th>
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
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-surface-sunken">
                        {r.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.logo} alt="" width={36} height={36} loading="lazy" className="size-full object-contain" />
                        ) : null}
                      </div>
                      <Link href={`/admin/products?brand=${r.id}`} className="font-medium hover:text-primary-text hover:underline">
                        {r.name}
                      </Link>
                    </div>
                  </Td>
                  <Td className="num text-muted">{r.slug}</Td>
                  <Td className="text-muted">{r.country ?? "-"}</Td>
                  <Td numeric>{r.productCount}</Td>
                  <Td numeric>{r.sortOrder}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      <Badge tone={r.isActive ? "success" : "neutral"} dot>
                        {r.isActive ? t("active") : t("hidden")}
                      </Badge>
                      {r.isFeatured ? <Badge tone="accent">{t("featured")}</Badge> : null}
                    </div>
                  </Td>
                  {canWrite ? (
                    <Td>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label={t("edit", { name: r.name })} title={t("edit", { name: r.name })} onClick={() => setEditing(r)}>
                          <Pencil className="size-4" />
                        </Button>
                        <ConfirmActionButton
                          size="icon-sm"
                          aria-label={t("delete", { name: r.name })}
                          action={deleteBrandAction.bind(null, { id: r.id })}
                          title={t("deleteTitle", { name: r.name })}
                          description={r.productCount > 0 ? t("deleteBlocked") : t("deleteBody")}
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
      <Modal open={editing !== null} onClose={() => setEditing(null)} size="lg" title={editing && editing !== "new" ? t("editTitle", { name: editing.name }) : t("newTitle")}>
        {editing ? <BrandForm key={editing === "new" ? "new" : editing.id} row={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
      </Modal>
    </div>
  );
}

function BrandForm({ row, onClose }: { row: BrandRow | null; onClose: () => void }) {
  const t = useTranslations("admin.brands.form");
  const { run, pending, errorText } = useAdminAction();
  const form = useForm<Values>({
    resolver: zodResolver(formSchema) as unknown as Resolver<Values>,
    defaultValues: {
      brand: {
        slug: row?.slug ?? "",
        name: row?.name ?? "",
        description: row?.description ?? { en: "", tr: "" },
        logo: row?.logo ?? "",
        country: row?.country ?? "",
        website: row?.website ?? "",
        isActive: row?.isActive ?? true,
        isFeatured: row?.isFeatured ?? false,
        sortOrder: row?.sortOrder ?? 0,
      },
    },
  });
  const submit = form.handleSubmit((values) =>
    run(() => saveBrandAction({ id: row?.id, brand: values.brand }), {
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
          <RhfText name="brand.name" label={t("name")} required />
          <RhfText name="brand.slug" label={t("slug")} hint={t("slugHint")} className="font-mono" autoComplete="off" />
          <RhfText name="brand.country" label={t("country")} hint={t("countryHint")} maxLength={2} autoComplete="off" />
          <RhfText name="brand.website" label={t("website")} type="url" placeholder="https://" autoComplete="off" />
          <RhfInteger name="brand.sortOrder" label={t("sortOrder")} />
        </div>
        <RhfLocalized name="brand.description" label={t("description")} multiline rows={3} />
        <Controller control={form.control} name="brand.logo" render={({ field }) => <ImageUploadField label={t("logo")} value={field.value || undefined} onChange={(url) => field.onChange(url ?? "")} />} />
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <RhfSwitch name="brand.isActive" label={t("active")} />
          <RhfSwitch name="brand.isFeatured" label={t("featured")} description={t("featuredHint")} />
        </div>
        <ModalFormActions pending={pending} onCancel={onClose} />
      </form>
    </FormProvider>
  );
}
