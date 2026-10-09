import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Check, X } from "lucide-react";
import { Badge, Price } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/i18n-string";
import { discountPercent, type CurrencyContext } from "@/lib/money";
import type { ProductSummary } from "@/lib/types/domain";
import { cn } from "@/lib/utils";
import { QuickAddButton } from "./AddToCartButton";
import { RatingStars } from "./RatingStars";
import { WishlistButton } from "./WishlistButton";

export interface ProductCardProps {
  product: ProductSummary;
  locale: string;
  currency: CurrencyContext;
  signedIn: boolean;
  inWishlist: boolean;
  /** First cards above the fold load eagerly. */
  priority?: boolean;
  className?: string;
}

const isSvg = (src: string) => /\.svg(\?|$)/i.test(src);

/**
 * Product grid card in the workshop-manual idiom: a drawing plate on top (elevation by default, section view on
 * hover) and, under it, the part number as the headline, the name, a mono spec strip, price and add-to-cart.
 * The whole card is one link (stretched title anchor); the wishlist and quick-add buttons sit above it.
 */
export async function ProductCard({ product, locale, currency, signedIn, inWishlist, priority, className }: ProductCardProps) {
  const t = await getTranslations("store.card");
  const name = localize(product.name, locale);
  const outOfStock = product.stockStatus === "out_of_stock";
  const pct = product.compareAtFrom ? discountPercent(product.priceFrom, product.compareAtFrom) : 0;
  const alt = product.image ? localize(product.image.alt, locale) : name;
  const ratingLabel = t("rating", { rating: product.ratingAverage.toFixed(1), count: product.ratingCount });
  const strip = product.highlights.map((h) => localize(h, locale));

  return (
    <article className={cn("group relative flex flex-col", className)}>
      <div className="relative aspect-square overflow-hidden border border-border-strong bg-surface-sunken transition-colors duration-200 group-hover:border-foreground">
        {product.image ? (
          <>
            <Image
              src={product.image.url}
              alt={alt}
              fill
              sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 46vw"
              priority={priority}
              unoptimized={isSvg(product.image.url)}
              className={cn("object-cover transition-opacity duration-300 ease-out", product.secondImage && "group-hover:opacity-0 group-focus-within:opacity-0", outOfStock && "opacity-60")}
            />
            {product.secondImage ? (
              <Image
                src={product.secondImage.url}
                alt=""
                fill
                sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 46vw"
                unoptimized={isSvg(product.secondImage.url)}
                className="object-cover opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100 group-focus-within:opacity-100"
              />
            ) : null}
          </>
        ) : null}

        <div className="pointer-events-none absolute left-2.5 top-2.5 z-[2] flex flex-col items-start gap-1.5">
          {pct > 0 ? (
            <Badge tone="accent" className="chamfer-sm px-2 py-1.5">
              -{pct}%
            </Badge>
          ) : null}
          {outOfStock ? (
            // A chip in the badge slot, not a bar across the plate: the drawing's title block (DWG, FIG, SCALE, REV) stays readable.
            <Badge tone="inverse" className="px-2 py-1.5">
              {t("outOfStock")}
            </Badge>
          ) : null}
        </div>
        <div className="absolute right-2 top-2 z-[2]">
          <WishlistButton productId={product.id} productName={name} initialInWishlist={inWishlist} signedIn={signedIn} />
        </div>
      </div>

      <div className="mt-3 flex flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <p className="part-no text-[0.9375rem] leading-none text-foreground transition-colors group-hover:text-primary-text">
            <span className="sr-only">{t("partNumber")}: </span>
            {product.partNumber}
          </p>
          {product.fitsSelectedVehicle === true ? (
            <Badge tone="success" className="gap-1 px-1.5 py-1 text-[0.6875rem]">
              <Check className="size-3" strokeWidth={3} aria-hidden />
              {t("fits")}
            </Badge>
          ) : null}
          {product.fitsSelectedVehicle === false ? (
            <Badge tone="danger" className="gap-1 px-1.5 py-1 text-[0.6875rem]">
              <X className="size-3" strokeWidth={3} aria-hidden />
              {t("doesNotFit")}
            </Badge>
          ) : null}
        </div>
        <h3 className="font-sans text-[0.9375rem] font-semibold normal-case leading-snug tracking-normal">
          <Link href={`/product/${product.slug}`} className="line-clamp-2 text-foreground after:absolute after:inset-0 after:z-0 hover:underline hover:underline-offset-4 focus-visible:outline-offset-4">
            {name}
          </Link>
        </h3>
        {strip.length > 0 ? (
          <p className="tag-mono truncate text-muted" title={strip.join(" · ")}>
            {strip.join(" · ")}
          </p>
        ) : null}
        {product.ratingCount > 0 ? (
          <div className="flex items-center gap-1.5 text-[0.8125rem] text-muted">
            <RatingStars value={product.ratingAverage} label={ratingLabel} />
            <span className="num">({product.ratingCount})</span>
          </div>
        ) : null}
        {/* Footer: always one note line above the price, so the price (and quick-add) sit on the same baseline in every card of a row. */}
        <div className="mt-auto flex items-end justify-between gap-3 pt-2">
          <div className="min-w-0">
            <p className="tag-mono flex min-h-[0.875rem] flex-wrap items-center gap-x-2 leading-none">
              {product.hasMultiplePrices ? <span className="text-muted">{t("from")}</span> : null}
              {product.stockStatus === "low_stock" ? <span className="text-warning">{t("lowStock")}</span> : null}
            </p>
            <Price amount={product.priceFrom} compareAt={product.compareAtFrom} locale={locale} currency={currency} size="md" className="mt-1" />
          </div>
          {product.variantCount === 1 && !outOfStock ? <QuickAddButton variantId={product.defaultVariantId} productName={name} /> : null}
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 xl:grid-cols-4", className)}>{children}</div>;
}
