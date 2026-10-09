import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { ListFooter } from "@/components/admin/common/ListFooter";
import { FilterBar, SearchFilter, SelectFilter } from "@/components/admin/common/FilterBar";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { flattenCategories } from "@/components/admin/lib/categories";
import { guard } from "@/components/admin/lib/guard";
import { enumParam, hrefWith, intParam, param, type SearchParams } from "@/components/admin/lib/params";
import { CsvTools } from "@/components/admin/products/CsvTools";
import { ProductsTable, type ProductTableRow, type SortLink } from "@/components/admin/products/ProductsTable";
import { buttonStyles } from "@/components/ui/Button";
import { localize } from "@/lib/i18n-string";
import { can } from "@/lib/permissions";
import { adminListProducts, getCategoryTree, listBrands } from "@/lib/services/catalog";
import type { AdminProductFilter } from "@/lib/services/contracts";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.products");
  return { title: t("title") };
}

const BASE = "/admin/products";
const STATUSES = ["all", "active", "draft", "archived"] as const;
const SORTS = ["updated_desc", "name_asc", "price_asc", "price_desc", "stock_asc", "sold_desc"] as const;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { user } = await guard("catalog.read");
  const sp = await searchParams;
  const [t, locale] = await Promise.all([getTranslations("admin.products"), getLocale()]);

  const q = param(sp, "q");
  const status = enumParam(sp, "status", STATUSES, "all");
  const categoryId = param(sp, "category");
  const brandId = param(sp, "brand");
  const low = param(sp, "low") === "1";
  const sort = enumParam(sp, "sort", SORTS, "updated_desc");
  const page = intParam(sp, "page", 1);

  const filter: AdminProductFilter = { page, pageSize: 25, status, sort, ...(q ? { q } : {}), ...(categoryId ? { categoryId } : {}), ...(brandId ? { brandId } : {}), ...(low ? { lowStockOnly: true } : {}) };
  const [result, brands, tree] = await Promise.all([adminListProducts(filter), listBrands({ includeInactive: true }), getCategoryTree({ includeInactive: true })]);
  const categories = flattenCategories(tree, locale);

  const rows: ProductTableRow[] = result.items.map((r) => ({
    id: r.product.id,
    name: localize(r.product.name, locale),
    partNumber: r.product.partNumber,
    image: r.image?.url,
    brand: r.brandName,
    category: localize(r.categoryName, locale),
    status: r.product.status,
    isFeatured: r.product.isFeatured,
    variantCount: r.variantCount,
    priceFrom: r.priceFrom,
    totalAvailable: r.totalAvailable,
    lowStock: r.lowStock,
    updatedAt: r.product.updatedAt,
  }));

  const link = (value: (typeof SORTS)[number]) => hrefWith(BASE, sp, { sort: value === "updated_desc" ? null : value, page: null });
  const sorts: Record<"name" | "price" | "stock" | "updated", SortLink> = {
    name: { state: sort === "name_asc" ? "asc" : "none", href: link("name_asc") },
    price: { state: sort === "price_asc" ? "asc" : sort === "price_desc" ? "desc" : "none", href: link(sort === "price_asc" ? "price_desc" : "price_asc") },
    stock: { state: sort === "stock_asc" ? "asc" : "none", href: link("stock_asc") },
    updated: { state: sort === "updated_desc" ? "desc" : "none", href: link("updated_desc") },
  };

  const canWrite = can(user.role, "catalog.write");
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle", { count: result.total })}
        actions={
          <>
            <CsvTools canImport={canWrite} />
            {canWrite ? (
              <Link href="/admin/products/new" className={buttonStyles({ size: "sm" })}>
                <Plus className="size-4" aria-hidden />
                {t("new")}
              </Link>
            ) : null}
          </>
        }
      />
      <FilterBar action={BASE} hidden={{ sort: sort === "updated_desc" ? undefined : sort }}>
        <SearchFilter value={q} placeholder={t("list.searchPlaceholder")} />
        <SelectFilter
          name="status"
          label={t("list.status")}
          value={status === "all" ? "" : status}
          allLabel={t("list.allStatuses")}
          options={STATUSES.filter((s) => s !== "all").map((s) => ({ value: s, label: t(`list.statuses.${s}`) }))}
        />
        <SelectFilter name="category" label={t("list.category")} value={categoryId} allLabel={t("list.allCategories")} options={categories.map((c) => ({ value: c.id, label: c.label }))} />
        <SelectFilter name="brand" label={t("list.brand")} value={brandId} allLabel={t("list.allBrands")} options={brands.map((b) => ({ value: b.id, label: b.name }))} />
        <SelectFilter name="low" label={t("list.stock")} value={low ? "1" : ""} allLabel={t("list.anyStock")} options={[{ value: "1", label: t("list.lowOnly") }]} />
      </FilterBar>
      <ProductsTable rows={rows} sorts={sorts} canWrite={canWrite} />
      <ListFooter base={BASE} sp={sp} page={result.page} pageSize={result.pageSize} total={result.total} pageCount={result.pageCount} />
    </>
  );
}
