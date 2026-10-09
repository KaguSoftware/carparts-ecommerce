import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PenLine } from "lucide-react";
import { ReviewList } from "@/components/account/reviews/ReviewList";
import { privatePageMetadata } from "@/components/account/seo";
import { AccountPageHeader } from "@/components/account/shell/PageHeader";
import { ProductThumb } from "@/components/store/product/ProductThumb";
import { buttonStyles } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/session";
import { localize } from "@/lib/i18n-string";
import { wasPaid } from "@/lib/order-status";
import { getProductSummaries } from "@/lib/services/catalog";
import { listOrdersForUser } from "@/lib/services/orders";
import { listReviewsForUser } from "@/lib/services/reviews";

type PageProps = { params: Promise<{ locale: string }> };

const MAX_SUGGESTIONS = 6;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account.reviews" });
  return privatePageMetadata(t("metaTitle"));
}

export default async function ReviewsPage({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;
  const user = await requireUser(locale, "/account/reviews");
  const t = await getTranslations("account.reviews");

  const [reviews, orders] = await Promise.all([listReviewsForUser(user.id), listOrdersForUser(user.id, { page: 1, pageSize: 100 })]);

  // Products bought (paid, not cancelled) that the customer has not reviewed yet, most recent purchase first.
  const reviewed = new Set(reviews.map((r) => r.productId));
  const candidates: string[] = [];
  for (const order of orders.items) {
    if (!wasPaid(order.paymentStatus) || order.status === "cancelled" || order.status === "refunded") continue;
    for (const item of order.items) {
      if (!reviewed.has(item.productId) && !candidates.includes(item.productId)) candidates.push(item.productId);
    }
  }
  const suggestions = candidates.length > 0 ? await getProductSummaries(candidates.slice(0, MAX_SUGGESTIONS)) : [];

  return (
    <>
      <AccountPageHeader title={t("title")} description={t("subtitle")} />

      {suggestions.length > 0 ? (
        <section aria-labelledby="to-review" className="mb-12">
          <h2 id="to-review" className="display-4 mb-4">
            {t("toReview")}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {suggestions.map((product) => (
              <li key={product.id} className="flex items-center gap-3 rounded-md border border-border bg-surface p-3">
                <ProductThumb src={product.image?.url} alt="" className="size-14" sizes="56px" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{localize(product.name, locale)}</p>
                  <p className="truncate text-[0.8125rem] text-muted">{product.brand.name}</p>
                </div>
                <Link href={`/product/${product.slug}#reviews`} className={buttonStyles({ variant: "outline", size: "sm" })}>
                  <PenLine className="size-3.5" aria-hidden />
                  {t("write")}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {reviews.length === 0 ? (
        <div className="rounded-md border border-dashed border-border-strong px-6 py-14 text-center">
          <p className="display-4">{t("emptyTitle")}</p>
          <p className="mx-auto mt-2 max-w-sm text-muted">{t("emptyBody")}</p>
        </div>
      ) : (
        <section aria-labelledby="my-reviews">
          <h2 id="my-reviews" className="display-4 mb-4">
            {t("yourReviews", { count: reviews.length })}
          </h2>
          <ReviewList reviews={reviews} locale={locale} />
        </section>
      )}
    </>
  );
}
