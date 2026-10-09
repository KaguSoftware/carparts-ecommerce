import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { CouponsManager, type CouponRow } from "@/components/admin/coupons/CouponsManager";
import { FilterBar, SearchFilter, SelectFilter } from "@/components/admin/common/FilterBar";
import { ListFooter } from "@/components/admin/common/ListFooter";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { flattenCategories } from "@/components/admin/lib/categories";
import { guard } from "@/components/admin/lib/guard";
import { enumParam, intParam, param, type SearchParams } from "@/components/admin/lib/params";
import { can } from "@/lib/permissions";
import { getCategoryTree, listBrands } from "@/lib/services/catalog";
import { couponStatus, listCoupons } from "@/lib/services/coupons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.coupons");
  return { title: t("title") };
}

const BASE = "/admin/coupons";
const STATUSES = ["all", "active", "scheduled", "expired", "disabled"] as const;

export default async function CouponsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { user } = await guard("marketing.write");
  const sp = await searchParams;
  const [t, locale] = await Promise.all([getTranslations("admin.coupons"), getLocale()]);
  const q = param(sp, "q");
  const status = enumParam(sp, "status", STATUSES, "all");
  const page = intParam(sp, "page", 1);
  const [result, tree, brands] = await Promise.all([listCoupons({ page, pageSize: 25, status, ...(q ? { q } : {}) }), getCategoryTree({ includeInactive: true }), listBrands({ includeInactive: true })]);

  const rows: CouponRow[] = result.items.map((c) => ({
    id: c.id,
    code: c.code,
    description: c.description,
    type: c.type,
    value: c.value,
    minSubtotal: c.minSubtotal,
    maxDiscount: c.maxDiscount,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    usageLimit: c.usageLimit,
    perUserLimit: c.perUserLimit,
    usedCount: c.usedCount,
    categoryIds: c.appliesTo?.categoryIds ?? [],
    brandIds: c.appliesTo?.brandIds ?? [],
    isActive: c.isActive,
    status: couponStatus(c),
  }));

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle", { count: result.total })} />
      <FilterBar action={BASE}>
        <SearchFilter value={q} placeholder={t("searchPlaceholder")} />
        <SelectFilter name="status" label={t("filters.status")} value={status === "all" ? "" : status} allLabel={t("filters.all")} options={STATUSES.filter((s) => s !== "all").map((s) => ({ value: s, label: t(`filters.${s}`) }))} />
      </FilterBar>
      <CouponsManager
        rows={rows}
        categories={flattenCategories(tree, locale).map((c) => ({ id: c.id, label: c.label }))}
        brands={brands.map((b) => ({ id: b.id, name: b.name }))}
        canWrite={can(user.role, "marketing.write")}
      />
      <ListFooter base={BASE} sp={sp} page={result.page} pageSize={result.pageSize} total={result.total} pageCount={result.pageCount} />
    </>
  );
}
