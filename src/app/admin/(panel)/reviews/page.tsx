import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { BadgeCheck, Star } from "lucide-react";
import { FilterBar, SearchFilter, SelectFilter } from "@/components/admin/common/FilterBar";
import { EmptyState } from "@/components/admin/common/EmptyState";
import { ListFooter } from "@/components/admin/common/ListFooter";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { StatusBadge } from "@/components/admin/common/StatusBadge";
import { guard } from "@/components/admin/lib/guard";
import { enumParam, intParam, param, type SearchParams } from "@/components/admin/lib/params";
import { ReviewActions } from "@/components/admin/reviews/ReviewActions";
import { localize } from "@/lib/i18n-string";
import { adminListReviews } from "@/lib/services/reviews";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.reviews");
  return { title: t("title") };
}

const BASE = "/admin/reviews";
const STATUSES = ["all", "pending", "approved", "rejected"] as const;

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await guard("reviews.moderate");
  const sp = await searchParams;
  const [t, locale, format] = await Promise.all([getTranslations("admin.reviews"), getLocale(), getFormatter()]);
  const q = param(sp, "q");
  const status = enumParam(sp, "status", STATUSES, "all");
  const rating = intParam(sp, "rating", 0, 0, 5);
  const page = intParam(sp, "page", 1);
  const result = await adminListReviews({ page, pageSize: 20, status, ...(q ? { q } : {}), ...(rating ? { rating } : {}) });

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle", { count: result.total })} />
      <FilterBar action={BASE}>
        <SearchFilter value={q} placeholder={t("searchPlaceholder")} />
        <SelectFilter name="status" label={t("filters.status")} value={status === "all" ? "" : status} allLabel={t("filters.allStatuses")} options={STATUSES.filter((s) => s !== "all").map((s) => ({ value: s, label: t(`filters.${s}`) }))} />
        <SelectFilter name="rating" label={t("filters.rating")} value={rating ? String(rating) : ""} allLabel={t("filters.anyRating")} options={[5, 4, 3, 2, 1].map((r) => ({ value: String(r), label: t("filters.stars", { count: r }) }))} />
      </FilterBar>

      {result.items.length === 0 ? (
        <div className="rounded-md border border-border bg-surface">
          <EmptyState icon={Star} title={t("empty")} />
        </div>
      ) : (
        <ul className="space-y-3">
          {result.items.map((r) => (
            <li key={r.id} className="rounded-md border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span role="img" aria-label={t("starsLabel", { count: r.rating })} className="inline-flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} aria-hidden className={`size-4 ${n <= r.rating ? "fill-accent text-accent" : "text-border-strong"}`} />
                      ))}
                    </span>
                    <StatusBadge kind="review" value={r.status} />
                    {r.verifiedPurchase ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success">
                        <BadgeCheck className="size-3.5" aria-hidden />
                        {t("verified")}
                      </span>
                    ) : null}
                    <span className="text-xs uppercase text-subtle">{r.locale}</span>
                  </div>
                  <p className="mt-1.5 font-medium">{r.title}</p>
                  <p className="mt-0.5 max-w-prose whitespace-pre-wrap text-sm text-muted">{r.body}</p>
                  <p className="mt-2 text-xs text-muted">
                    {r.authorName} · {format.dateTime(new Date(r.createdAt), { dateStyle: "medium" })} ·{" "}
                    <Link href={`/admin/products/${r.productId}`} className="underline underline-offset-2 hover:text-foreground">
                      {localize(r.productName, locale)}
                    </Link>
                  </p>
                  {r.adminReply ? (
                    <div className="mt-3 max-w-prose rounded-md bg-surface-sunken p-3 text-sm">
                      <p className="label-caps mb-1 text-muted">{t("storeReply")}</p>
                      <p className="whitespace-pre-wrap">{r.adminReply.body}</p>
                    </div>
                  ) : null}
                </div>
                <ReviewActions id={r.id} status={r.status} reply={r.adminReply?.body} author={r.authorName} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <ListFooter base={BASE} sp={sp} page={result.page} pageSize={result.pageSize} total={result.total} pageCount={result.pageCount} />
    </>
  );
}
