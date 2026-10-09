"use client";

import { Controller, FormProvider, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { createProductAction, updateProductAction } from "@/actions/admin/products";
import { createProductSchema, productInputSchema, type ProductFormInput, type VariantFormInput } from "@/actions/admin/products.schema";
import { Checkbox } from "@/components/ui/Checkbox";
import { applyServerErrors, emptyLs } from "../forms/form-utils";
import { FormError, FormFooter, FormSection } from "../forms/FormParts";
import { PairsEditor } from "../forms/PairsEditor";
import { RhfInteger, RhfList, RhfLocalized, RhfMoney, RhfSelect, RhfSwitch, RhfText } from "../forms/RhfFields";
import { useAdminAction } from "../forms/use-admin-action";

export interface ProductFormProps {
  mode: { kind: "create" } | { kind: "edit"; id: string };
  initial?: ProductFormInput;
  brands: { id: string; name: string }[];
  /** Flat, tree-ordered; `label` already localised and indented. */
  categories: { id: string; label: string }[];
  defaultLowStockThreshold: number;
}

interface FormValues {
  product: ProductFormInput;
  variant: VariantFormInput;
}

const editSchema = z.object({ product: productInputSchema });

export function blankProduct(): ProductFormInput {
  return {
    slug: "",
    name: emptyLs(),
    summary: emptyLs(),
    description: emptyLs(),
    brandId: "",
    categoryId: "",
    categoryIds: [],
    specs: [],
    tags: [],
    status: "draft",
    isFeatured: false,
    partNumber: "",
    oemNumbers: [],
    warrantyMonths: 12,
    fitment: "specific",
    seoTitle: emptyLs(),
    seoDescription: emptyLs(),
  };
}

function blankVariant(lowStockThreshold: number): VariantFormInput {
  return {
    sku: "",
    name: { en: "Standard", tr: "Standart" },
    options: [],
    price: undefined as unknown as number,
    compareAtPrice: undefined,
    cost: undefined,
    initialStock: 0,
    lowStockThreshold,
    weightGrams: 0,
    barcode: "",
    imageId: "",
    isActive: true,
    isDefault: true,
  };
}

export function ProductForm({ mode, initial, brands, categories, defaultLowStockThreshold }: ProductFormProps) {
  const t = useTranslations("admin.products.form");
  const ts = useTranslations("admin.status");
  const router = useRouter();
  const { run, pending, errorText } = useAdminAction();
  const creating = mode.kind === "create";

  const form = useForm<FormValues>({
    resolver: zodResolver(creating ? createProductSchema : editSchema) as unknown as Resolver<FormValues>,
    defaultValues: { product: initial ?? blankProduct(), variant: blankVariant(defaultLowStockThreshold) },
  });

  const onSubmit = form.handleSubmit((values) =>
    run(() => (mode.kind === "create" ? createProductAction(values) : updateProductAction({ id: mode.id, product: values.product })), {
      success: creating ? t("created") : t("saved"),
      toastError: false,
      refresh: !creating,
      onSuccess: (data) => {
        if (creating) router.push(`/admin/products/${data.id}`);
        else form.reset({ ...values });
      },
      onError: (failure) => applyServerErrors(form.setError, failure),
    }),
  );

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate>
        <FormError text={errorText} />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-4">
            <FormSection title={t("basics")}>
              <RhfLocalized name="product.name" label={t("name")} required />
              <RhfLocalized name="product.summary" label={t("summary")} hint={t("summaryHint")} multiline rows={2} required />
              <RhfLocalized name="product.description" label={t("description")} hint={t("descriptionHint")} multiline rows={8} mono />
            </FormSection>

            <FormSection title={t("specs")} description={t("specsHint")}>
              <Controller
                control={form.control}
                name="product.specs"
                render={({ field }) => (
                  <PairsEditor
                    field="key"
                    value={field.value}
                    onChange={field.onChange}
                    labels={{ key: t("specKey"), value: t("specValue"), add: t("addSpec"), remove: t("removeRow"), empty: t("noSpecs") }}
                  />
                )}
              />
            </FormSection>

            {creating ? (
              <FormSection title={t("firstVariant")} description={t("firstVariantHint")}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <RhfText name="variant.sku" label={t("sku")} required autoComplete="off" className="font-mono" />
                  <RhfText name="variant.barcode" label={t("barcode")} />
                </div>
                <RhfLocalized name="variant.name" label={t("variantName")} required />
                <div className="grid gap-4 sm:grid-cols-3">
                  <RhfMoney name="variant.price" label={t("price")} required hint={t("usd")} />
                  <RhfMoney name="variant.compareAtPrice" label={t("compareAt")} hint={t("compareAtHint")} />
                  <RhfMoney name="variant.cost" label={t("cost")} hint={t("costHint")} />
                  <RhfInteger name="variant.initialStock" label={t("initialStock")} />
                  <RhfInteger name="variant.lowStockThreshold" label={t("lowStock")} />
                  <RhfInteger name="variant.weightGrams" label={t("weight")} hint={t("grams")} />
                </div>
              </FormSection>
            ) : null}

            <FormSection title={t("seo")} description={t("seoHint")}>
              <RhfLocalized name="product.seoTitle" label={t("seoTitle")} />
              <RhfLocalized name="product.seoDescription" label={t("seoDescription")} multiline rows={2} />
            </FormSection>
          </div>

          <div className="space-y-4">
            <FormSection title={t("organisation")}>
              <RhfSelect name="product.status" label={t("status")} required>
                <option value="draft">{ts("product.draft")}</option>
                <option value="active">{ts("product.active")}</option>
                <option value="archived">{ts("product.archived")}</option>
              </RhfSelect>
              <RhfSwitch name="product.isFeatured" label={t("featured")} description={t("featuredHint")} />
              <RhfSelect name="product.brandId" label={t("brand")} required>
                <option value="">{t("choose")}</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </RhfSelect>
              <RhfSelect name="product.categoryId" label={t("category")} required>
                <option value="">{t("choose")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </RhfSelect>
              <details className="rounded-sm border border-border">
                <summary className="px-3 py-2 text-sm font-medium">{t("moreCategories")}</summary>
                <Controller
                  control={form.control}
                  name="product.categoryIds"
                  render={({ field }) => (
                    <ul className="max-h-56 space-y-1.5 overflow-y-auto border-t border-border p-3">
                      {categories.map((c) => (
                        <li key={c.id}>
                          <Checkbox
                            label={c.label}
                            checked={field.value.includes(c.id)}
                            onChange={(e) => field.onChange(e.target.checked ? [...field.value, c.id] : field.value.filter((id: string) => id !== c.id))}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                />
              </details>
            </FormSection>

            <FormSection title={t("identification")}>
              <RhfText name="product.partNumber" label={t("partNumber")} required className="font-mono" />
              <RhfList name="product.oemNumbers" label={t("oemNumbers")} hint={t("commaHint")} />
              <RhfList name="product.tags" label={t("tags")} hint={t("commaHint")} />
              <RhfInteger name="product.warrantyMonths" label={t("warranty")} hint={t("months")} />
            </FormSection>

            <FormSection title={t("fitmentTitle")}>
              <RhfSelect name="product.fitment" label={t("fitmentType")} hint={t("fitmentTypeHint")}>
                <option value="specific">{t("fitmentSpecific")}</option>
                <option value="universal">{t("fitmentUniversal")}</option>
              </RhfSelect>
              <RhfText name="product.slug" label={t("slug")} hint={t("slugHint")} autoComplete="off" className="font-mono" />
            </FormSection>
          </div>
        </div>
        <FormFooter pending={pending} saveLabel={creating ? t("create") : undefined} cancelHref="/admin/products" />
      </form>
    </FormProvider>
  );
}
