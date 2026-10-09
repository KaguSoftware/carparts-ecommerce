import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { flattenCategories } from "@/components/admin/lib/categories";
import { guard } from "@/components/admin/lib/guard";
import { ProductForm } from "@/components/admin/products/ProductForm";
import { getCategoryTree, listBrands } from "@/lib/services/catalog";
import { getSettings } from "@/lib/services/settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.products");
  return { title: t("new") };
}

export default async function NewProductPage() {
  await guard("catalog.write");
  const [t, locale, brands, tree, settings] = await Promise.all([getTranslations("admin.products"), getLocale(), listBrands({ includeInactive: true }), getCategoryTree({ includeInactive: true }), getSettings()]);
  return (
    <>
      <PageHeader title={t("new")} description={t("newSubtitle")} back={{ href: "/admin/products", label: t("title") }} />
      <ProductForm
        mode={{ kind: "create" }}
        brands={brands.map((b) => ({ id: b.id, name: b.name }))}
        categories={flattenCategories(tree, locale).map((c) => ({ id: c.id, label: c.label }))}
        defaultLowStockThreshold={settings.inventory.defaultLowStockThreshold}
      />
    </>
  );
}
