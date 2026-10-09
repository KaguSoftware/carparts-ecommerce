import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { StatusBadge } from "@/components/admin/common/StatusBadge";
import { flattenCategories } from "@/components/admin/lib/categories";
import { guard } from "@/components/admin/lib/guard";
import { FitmentEditor } from "@/components/admin/products/FitmentEditor";
import { ImagesManager } from "@/components/admin/products/ImagesManager";
import { ProductForm, type ProductFormProps } from "@/components/admin/products/ProductForm";
import { VariantsManager } from "@/components/admin/products/VariantsManager";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { localize } from "@/lib/i18n-string";
import { can } from "@/lib/permissions";
import { adminGetProduct, getCategoryTree, listBrands } from "@/lib/services/catalog";
import { availableOf, getStockStatus } from "@/lib/services/inventory";
import { getSettings } from "@/lib/services/settings";
import { listFitment, listMakes, listModels } from "@/lib/services/vehicles";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const [t, locale, data] = await Promise.all([getTranslations("admin.products"), getLocale(), adminGetProduct(id)]);
  return { title: data ? localize(data.product.name, locale) : t("title") };
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await guard("catalog.read");
  const { id } = await params;
  const data = await adminGetProduct(id);
  if (!data) notFound();
  const { product, variants } = data;

  const [t, locale, brands, tree, settings, fitment, makes] = await Promise.all([
    getTranslations("admin.products"),
    getLocale(),
    listBrands({ includeInactive: true }),
    getCategoryTree({ includeInactive: true }),
    getSettings(),
    listFitment(id),
    listMakes(),
  ]);
  const models = (await Promise.all(makes.map((m) => listModels(m.id)))).flat();

  const canWrite = can(user.role, "catalog.write");
  const initial: ProductFormProps["initial"] = {
    slug: product.slug,
    name: product.name,
    summary: product.summary,
    description: product.description,
    brandId: product.brandId,
    categoryId: product.categoryId,
    categoryIds: product.categoryIds.filter((c) => c !== product.categoryId),
    specs: product.specs,
    tags: product.tags,
    status: product.status,
    isFeatured: product.isFeatured,
    partNumber: product.partNumber,
    oemNumbers: product.oemNumbers,
    warrantyMonths: product.warrantyMonths,
    fitment: product.fitment,
    seoTitle: product.seoTitle ?? { en: "", tr: "" },
    seoDescription: product.seoDescription ?? { en: "", tr: "" },
  };

  const variantRows = variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    name: v.name,
    options: v.options,
    price: v.price,
    compareAtPrice: v.compareAtPrice,
    cost: v.cost,
    stockOnHand: v.stockOnHand,
    stockReserved: v.stockReserved,
    lowStockThreshold: v.lowStockThreshold,
    weightGrams: v.weightGrams,
    barcode: v.barcode,
    imageId: v.imageId,
    isActive: v.isActive,
    isDefault: v.isDefault,
    stockStatus: getStockStatus(availableOf(v), v.lowStockThreshold),
  }));

  return (
    <>
      <PageHeader
        title={localize(product.name, locale)}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge kind="product" value={product.status} />
            <span className="num">{product.partNumber}</span>
            <span aria-hidden>·</span>
            <span>{t("edit.sold", { count: product.soldCount })}</span>
          </span>
        }
        back={{ href: "/admin/products", label: t("title") }}
        actions={
          product.status === "active" ? (
            <a href={`/${locale}/product/${product.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary-text underline underline-offset-4">
              {t("edit.viewInStore")}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null
        }
      />
      <Tabs
        aria-label={t("edit.tabs")}
        tabs={[
          {
            id: "general",
            label: t("edit.general"),
            content: canWrite ? (
              <ProductForm
                mode={{ kind: "edit", id }}
                initial={initial}
                brands={brands.map((b) => ({ id: b.id, name: b.name }))}
                categories={flattenCategories(tree, locale).map((c) => ({ id: c.id, label: c.label }))}
                defaultLowStockThreshold={settings.inventory.defaultLowStockThreshold}
              />
            ) : (
              <p className="text-sm text-muted">{t("edit.readOnly")}</p>
            ),
          },
          {
            id: "variants",
            label: t("edit.variants"),
            badge: <Badge tone="neutral">{variants.length}</Badge>,
            content: (
              <VariantsManager
                productId={id}
                variants={variantRows}
                images={product.images.map((i) => ({ id: i.id, alt: i.alt, url: i.url }))}
                defaultLowStockThreshold={settings.inventory.defaultLowStockThreshold}
                canWrite={canWrite}
                canAdjustStock={can(user.role, "inventory.write")}
              />
            ),
          },
          {
            id: "images",
            label: t("edit.images"),
            badge: <Badge tone="neutral">{product.images.length}</Badge>,
            content: <ImagesManager productId={id} initial={product.images.map((i) => ({ url: i.url, alt: i.alt }))} canWrite={canWrite} />,
          },
          {
            id: "fitment",
            label: t("edit.fitment"),
            badge: <Badge tone="neutral">{product.fitment === "universal" ? t("edit.universal") : fitment.length}</Badge>,
            content: (
              <FitmentEditor
                productId={id}
                fitmentType={product.fitment}
                current={fitment.map((f) => ({ vehicleId: f.vehicleId, label: f.vehicle.label, fuel: f.vehicle.fuel }))}
                makes={makes.map((m) => ({ id: m.id, name: m.name }))}
                models={models.map((m) => ({ id: m.id, makeId: m.makeId, name: m.name }))}
                canWrite={canWrite}
              />
            ),
          },
        ]}
      />
    </>
  );
}
