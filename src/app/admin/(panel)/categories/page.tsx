import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { CategoriesManager, type CategoryRow } from "@/components/admin/catalog/CategoriesManager";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { flattenCategories } from "@/components/admin/lib/categories";
import { guard } from "@/components/admin/lib/guard";
import { can } from "@/lib/permissions";
import { getCategoryTree } from "@/lib/services/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.categories");
  return { title: t("title") };
}

export default async function CategoriesPage() {
  const { user } = await guard("catalog.read");
  const [t, locale, tree] = await Promise.all([getTranslations("admin.categories"), getLocale(), getCategoryTree({ includeInactive: true })]);
  const flat = flattenCategories(tree, locale);
  const rows: CategoryRow[] = flat.map(({ node, depth }) => ({
    id: node.id,
    parentId: node.parentId,
    depth,
    slug: node.slug,
    name: node.name,
    description: node.description,
    image: node.image,
    icon: node.icon,
    sortOrder: node.sortOrder,
    isActive: node.isActive,
    productCount: node.productCount,
    childCount: node.children.length,
    seoTitle: node.seoTitle,
    seoDescription: node.seoDescription,
  }));
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle", { count: rows.length })} />
      <CategoriesManager rows={rows} canWrite={can(user.role, "catalog.write")} />
    </>
  );
}
