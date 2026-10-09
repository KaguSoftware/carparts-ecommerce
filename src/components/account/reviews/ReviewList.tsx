import { useFormatter, useTranslations } from "next-intl";
import { CornerDownRight, Star, ThumbsUp } from "lucide-react";
import { ProductThumb } from "@/components/store/product/ProductThumb";
import { Badge, type BadgeTone } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/i18n-string";
import type { LocalizedString, Review, ReviewStatus } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

export type AccountReview = Review & { productName: LocalizedString; productSlug: string; productImage?: string };

const STATUS_TONE: Record<ReviewStatus, BadgeTone> = { pending: "warning", approved: "success", rejected: "danger" };

function Stars({ rating }: { rating: number }) {
  const t = useTranslations("account.reviews");
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={t("ratingLabel", { rating })}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} aria-hidden className={cn("size-4", i < rating ? "fill-accent text-accent" : "text-border-strong")} />
      ))}
    </span>
  );
}

/** The signed-in customer's own reviews with their moderation state and any reply from the store. */
export function ReviewList({ reviews, locale }: { reviews: AccountReview[]; locale: string }) {
  const t = useTranslations("account.reviews");
  const format = useFormatter();

  return (
    <ul className="space-y-4">
      {reviews.map((review) => {
        const name = localize(review.productName, locale);
        return (
          <li key={review.id} className="rounded-md border border-border bg-surface p-5">
            <div className="flex gap-4">
              <ProductThumb src={review.productImage} alt="" className="size-16 sm:size-20" sizes="80px" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-base font-semibold normal-case leading-snug tracking-normal">
                    {review.productSlug ? (
                      <Link href={`/product/${review.productSlug}`} className="font-sans underline-offset-4 hover:underline">
                        {name}
                      </Link>
                    ) : (
                      <span className="font-sans">{name}</span>
                    )}
                  </h2>
                  <Badge tone={STATUS_TONE[review.status]} dot>
                    {t(`status.${review.status}`)}
                  </Badge>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                  <Stars rating={review.rating} />
                  <time dateTime={review.createdAt} className="num">
                    {format.dateTime(new Date(review.createdAt), { dateStyle: "medium" })}
                  </time>
                  {review.verifiedPurchase ? <span>{t("verified")}</span> : null}
                </div>
              </div>
            </div>
            <p className="mt-4 font-medium">{review.title}</p>
            <p className="mt-1 whitespace-pre-line text-[0.9375rem] text-muted">{review.body}</p>
            {review.status === "approved" && review.helpfulCount > 0 ? (
              <p className="num mt-3 flex items-center gap-1.5 text-sm text-muted">
                <ThumbsUp className="size-3.5" aria-hidden />
                {t("helpful", { count: review.helpfulCount })}
              </p>
            ) : null}
            {review.adminReply ? (
              <div className="mt-4 flex gap-2 rounded-sm bg-surface-sunken p-3.5 text-sm">
                <CornerDownRight className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                <div>
                  <p className="font-medium">{t("storeReply")}</p>
                  <p className="mt-0.5 text-muted">{review.adminReply.body}</p>
                </div>
              </div>
            ) : null}
            {review.status === "rejected" ? <p className="mt-3 text-sm text-muted">{t("rejectedNote")}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}
