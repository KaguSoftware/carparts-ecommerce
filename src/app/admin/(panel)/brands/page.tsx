import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BrandsManager, type BrandRow } from "@/components/admin/catalog/BrandsManager";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { guard } from "@/components/admin/lib/guard";
import { can } from "@/lib/permissions";
import { listBrands } from "@/lib/services/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.brands");
  return { title: t("title") };
}

export default async function BrandsPage() {
  const { user } = await guard("catalog.read");
  const [t, brands] = await Promise.all([getTranslations("admin.brands"), listBrands({ includeInactive: true })]);
  const rows: BrandRow[] = brands.map((b) => ({
    id: b.id,
    slug: b.slug,
    name: b.name,
    description: b.description,
    logo: b.logo,
    country: b.country,
    website: b.website,
    isActive: b.isActive,
    isFeatured: b.isFeatured,
    sortOrder: b.sortOrder,
    productCount: b.productCount,
  }));
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle", { count: rows.length })} />
      <BrandsManager rows={rows} canWrite={can(user.role, "catalog.write")} />
    </>
  );
}
