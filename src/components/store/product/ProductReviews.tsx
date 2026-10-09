import { getFormatter, getTranslations } from "next-intl/server";
import { BadgeCheck, MessageSquareReply } from "lucide-react";
import { Pagination } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { canReview, listApprovedReviews } from "@/lib/services/reviews";
import type { SessionUser } from "@/lib/types/domain";
import { cn } from "@/lib/utils";
import { HelpfulButton } from "./HelpfulButton";
import { RatingStars } from "./RatingStars";
import { ReviewForm } from "./ReviewForm";

export type ReviewSort = "newest" | "highest" | "lowest" | "helpful";
export const REVIEW_SORTS: ReviewSort[] = ["newest", "helpful", "highest", "lowest"];

export interface ProductReviewsProps {
  productId: string;
  slug: string;
  locale: Locale;
  user: SessionUser | null;
  average: number;
  count: number;
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>;
  sort: ReviewSort;
  page: number;
}

const href = (slug: string, sort: ReviewSort, page: number) => {
  const qs = new URLSearchParams();
  if (sort !== "newest") qs.set("rsort", sort);
  if (page > 1) qs.set("rpage", String(page));
  const q = qs.toString();
  return `/product/${slug}${q ? `?${q}` : ""}#reviews`;
};

/** Rating summary, review list (approved only), and the submit form. Streams in behind a Suspense boundary. */
export async function ProductReviews({ productId, slug, locale, user, average, count, breakdown, sort, page }: ProductReviewsProps) {
  const t = await getTranslations("store.reviews");
  const format = await getFormatter({ locale });
  const [list, eligibility] = await Promise.all([
    listApprovedReviews(productId, { sort, page, pageSize: 6 }),
    user ? canReview(user.id, productId) : Promise.resolve({ allowed: true, verifiedPurchase: false } as const),
  ]);

  return (
    <div className="grid gap-10 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-14">
      <div className="space-y-6">
        <div>
          <p className="num font-display text-6xl font-bold leading-none">{count > 0 ? average.toFixed(1) : "–"}</p>
          <RatingStars value={average} size="lg" className="mt-3" label={count > 0 ? t("ratingLabel", { rating: average.toFixed(1) }) : undefined} />
          <p className="mt-2 text-sm text-muted">{count > 0 ? t("basedOn", { count }) : t("noReviews")}</p>
        </div>
        {count > 0 ? (
          <ul className="space-y-1.5" aria-label={t("breakdown")}>
            {([5, 4, 3, 2, 1] as const).map((n) => {
              const c = breakdown[n] ?? 0;
              const pct = count ? Math.round((c / count) * 100) : 0;
              return (
                <li key={n} className="flex items-center gap-3 text-[0.8125rem]">
                  <span className="num w-12 shrink-0 text-muted">{t("starsShort", { count: n })}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="num w-8 shrink-0 text-right text-muted">{c}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <div className="space-y-10">
        {list.total > 0 ? (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <p className="text-sm text-muted">{t("showing", { count: list.total })}</p>
              <nav aria-label={t("sortBy")} className="flex flex-wrap items-center gap-1.5">
                {REVIEW_SORTS.map((s) => (
                  <Link
                    key={s}
                    href={href(slug, s, 1)}
                    scroll={false}
                    aria-current={sort === s ? "true" : undefined}
                    className={cn(
                      "inline-flex min-h-9 items-center rounded-sm px-3 text-[0.8125rem] font-medium",
                      sort === s ? "bg-secondary text-secondary-foreground" : "text-muted hover:bg-surface-sunken hover:text-foreground",
                    )}
                  >
                    {t(`sort.${s}`)}
                  </Link>
                ))}
              </nav>
            </div>
            <ul className="divide-y divide-border">
              {list.items.map((r) => (
                <li key={r.id} className="space-y-3 py-6">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <RatingStars value={r.rating} size="md" label={t("ratingLabel", { rating: r.rating })} />
                    <p className="font-semibold">{r.title}</p>
                  </div>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-muted">
                    <span className="font-medium text-foreground">{r.authorName}</span>
                    {r.verifiedPurchase ? (
                      <span className="inline-flex items-center gap-1 text-success">
                        <BadgeCheck className="size-4" aria-hidden />
                        {t("verified")}
                      </span>
                    ) : null}
                    <time dateTime={r.createdAt}>{format.dateTime(new Date(r.createdAt), { dateStyle: "medium" })}</time>
                  </p>
                  <p className="max-w-prose whitespace-pre-line text-[1rem] leading-relaxed text-foreground/90">{r.body}</p>
                  {r.adminReply ? (
                    <div className="max-w-prose rounded-md bg-surface-sunken px-4 py-3 text-[0.9375rem]">
                      <p className="mb-1 flex items-center gap-2 font-semibold">
                        <MessageSquareReply className="size-4 text-primary-text" aria-hidden />
                        {t("storeReply")}
                      </p>
                      <p className="whitespace-pre-line text-foreground/90">{r.adminReply.body}</p>
                    </div>
                  ) : null}
                  <HelpfulButton reviewId={r.id} initialCount={r.helpfulCount} />
                </li>
              ))}
            </ul>
            <Pagination page={list.page} pageCount={list.pageCount} linkAs={Link} buildHref={(p) => href(slug, sort, p)} />
          </div>
        ) : null}

        <div className="max-w-xl" id="write-review">
          <h3 className="display-4">{t("writeTitle")}</h3>
          {eligibility.allowed ? (
            <div className="mt-4">
              <ReviewForm productId={productId} signedIn={Boolean(user)} />
            </div>
          ) : (
            <p className="mt-3 text-muted">{t("alreadyReviewed")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
