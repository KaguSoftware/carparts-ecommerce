"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Controller, FormProvider, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { CornerDownRight, Pencil, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { deleteCategoryAction, saveCategoryAction } from "@/actions/admin/taxonomy";
import { categoryInputSchema, type CategoryFormInput } from "@/actions/admin/taxonomy.schema";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Table, TableContainer, TableEmpty, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { localize, type LocalizedString } from "@/lib/i18n-string";
import { ConfirmActionButton } from "../common/ConfirmActionButton";
import { applyServerErrors } from "../forms/form-utils";
import { FormError, ModalFormActions } from "../forms/FormParts";
import { ImageUploadField } from "../forms/ImageUpload";
import { RhfInteger, RhfLocalized, RhfSelect, RhfSwitch, RhfText } from "../forms/RhfFields";
import { useAdminAction } from "../forms/use-admin-action";

export interface CategoryRow {
  id: string;
  parentId: string | null;
  depth: number;
  slug: string;
  name: LocalizedString;
  description: LocalizedString;
  image?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  childCount: number;
  seoTitle?: LocalizedString;
  seoDescription?: LocalizedString;
}

const formSchema = z.object({ category: categoryInputSchema });
type Values = { category: CategoryFormInput };

function toValues(row: CategoryRow | null, parentId: string): Values {
  return {
    category: {
      slug: row?.slug ?? "",
      parentId: row ? (row.parentId ?? "") : parentId,
      name: row?.name ?? { en: "", tr: "" },
      description: row?.description ?? { en: "", tr: "" },
      image: row?.image ?? "",
      icon: row?.icon ?? "",
      sortOrder: row?.sortOrder ?? 0,
      isActive: row?.isActive ?? true,
      seoTitle: row?.seoTitle ?? { en: "", tr: "" },
      seoDescription: row?.seoDescription ?? { en: "", tr: "" },
    },
  };
}

export function CategoriesManager({ rows, canWrite }: { rows: CategoryRow[]; canWrite: boolean }) {
  const t = useTranslations("admin.categories");
  const locale = useLocale();
  const [editing, setEditing] = useState<{ row: CategoryRow | null; parentId: string } | null>(null);

  return (
    <div>
      {canWrite ? (
        <div className="mb-3 flex justify-end">
          <Button size="sm" leftIcon={<Plus className="size-4" />} onClick={() => setEditing({ row: null, parentId: "" })}>
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
              <TableEmpty colSpan={6}>{t("empty")}</TableEmpty>
            ) : (
              rows.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    <div className="flex items-center gap-2" style={{ paddingInlineStart: `${r.depth * 1.5}rem` }}>
                      {r.depth > 0 ? <CornerDownRight className="size-3.5 shrink-0 text-subtle" aria-hidden /> : null}
                      <Link href={`/admin/products?category=${r.id}`} className="font-medium hover:text-primary-text hover:underline">
                        {localize(r.name, locale)}
                      </Link>
                    </div>
                  </Td>
                  <Td className="num text-muted">{r.slug}</Td>
                  <Td numeric>{r.productCount}</Td>
                  <Td numeric>{r.sortOrder}</Td>
                  <Td>
                    <Badge tone={r.isActive ? "success" : "neutral"} dot>
                      {r.isActive ? t("active") : t("hidden")}
                    </Badge>
                  </Td>
                  {canWrite ? (
                    <Td>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label={t("addChild", { name: localize(r.name, locale) })} title={t("addChild", { name: localize(r.name, locale) })} onClick={() => setEditing({ row: null, parentId: r.id })}>
                          <Plus className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label={t("edit", { name: localize(r.name, locale) })} title={t("edit", { name: localize(r.name, locale) })} onClick={() => setEditing({ row: r, parentId: "" })}>
                          <Pencil className="size-4" />
                        </Button>
                        <ConfirmActionButton
                          size="icon-sm"
                          aria-label={t("delete", { name: localize(r.name, locale) })}
                          action={deleteCategoryAction.bind(null, { id: r.id })}
                          title={t("deleteTitle", { name: localize(r.name, locale) })}
                          description={r.productCount > 0 || r.childCount > 0 ? t("deleteBlocked") : t("deleteBody")}
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

      <Modal open={editing !== null} onClose={() => setEditing(null)} size="xl" title={editing?.row ? t("editTitle", { name: localize(editing.row.name, locale) }) : t("newTitle")}>
        {editing ? <CategoryForm key={editing.row?.id ?? `new-${editing.parentId}`} rows={rows} row={editing.row} parentId={editing.parentId} onClose={() => setEditing(null)} /> : null}
      </Modal>
    </div>
  );
}

function CategoryForm({ rows, row, parentId, onClose }: { rows: CategoryRow[]; row: CategoryRow | null; parentId: string; onClose: () => void }) {
  const t = useTranslations("admin.categories.form");
  const locale = useLocale();
  const { run, pending, errorText } = useAdminAction();
  const form = useForm<Values>({ resolver: zodResolver(formSchema) as unknown as Resolver<Values>, defaultValues: toValues(row, parentId) });

  // A category cannot be moved under itself or one of its own descendants.
  const blocked = useMemo(() => {
    const set = new Set<string>();
    if (!row) return set;
    set.add(row.id);
    let grew = true;
    while (grew) {
      grew = false;
      for (const r of rows) if (r.parentId && set.has(r.parentId) && !set.has(r.id)) {
          set.add(r.id);
          grew = true;
        }
    }
    return set;
  }, [rows, row]);

  const submit = form.handleSubmit((values) =>
    run(() => saveCategoryAction({ id: row?.id, category: values.category }), {
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
        <RhfLocalized name="category.name" label={t("name")} required />
        <RhfLocalized name="category.description" label={t("description")} multiline rows={3} />
        <div className="grid gap-4 sm:grid-cols-2">
          <RhfSelect name="category.parentId" label={t("parent")}>
            <option value="">{t("topLevel")}</option>
            {rows
              .filter((r) => !blocked.has(r.id))
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {`${"  ".repeat(r.depth)}${localize(r.name, locale)}`}
                </option>
              ))}
          </RhfSelect>
          <RhfText name="category.slug" label={t("slug")} hint={t("slugHint")} className="font-mono" autoComplete="off" />
          <RhfInteger name="category.sortOrder" label={t("sortOrder")} hint={t("sortOrderHint")} />
          <RhfText name="category.icon" label={t("icon")} hint={t("iconHint")} autoComplete="off" />
        </div>
        <Controller control={form.control} name="category.image" render={({ field }) => <ImageUploadField label={t("image")} value={field.value || undefined} onChange={(url) => field.onChange(url ?? "")} />} />
        <RhfSwitch name="category.isActive" label={t("active")} description={t("activeHint")} />
        <RhfLocalized name="category.seoTitle" label={t("seoTitle")} />
        <RhfLocalized name="category.seoDescription" label={t("seoDescription")} multiline rows={2} />
        <ModalFormActions pending={pending} onCancel={onClose} />
      </form>
    </FormProvider>
  );
}
