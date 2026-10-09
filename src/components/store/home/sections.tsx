import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Check, X } from "lucide-react";
import { SheetHeading } from "@/components/shared/SheetHeading";
import { Badge, Price } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { localize } from "@/lib/i18n-string";
import { discountPercent } from "@/lib/money";
import type { Banner, Brand, CategoryNode, ProductSummary } from "@/lib/types/domain";
import { cn } from "@/lib/utils";
import { QuickAddButton } from "../product/AddToCartButton";
import { ProductCard } from "../product/ProductCard";
import { ProductThumb } from "../product/ProductThumb";
import type { StoreContext } from "../shared/context";
import { SmartLink } from "../shared/SmartLink";

/** Kept for other pages; the home page itself uses numbered {@link SheetHeading}s. */
export function SectionHeader({ id, title, href, linkLabel, description }: { id: string; title: string; href?: string; linkLabel?: string; description?: string }) {
  return (
    <div className="mb-7">
      <SheetHeading id={id} title={title} {...(href ? { href } : {})} {...(linkLabel ? { linkLabel } : {})} />
      {description ? <p className="mt-2 max-w-xl text-muted">{description}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ 01 index of assemblies */

/**
 * Categories as an index plate: numbered assemblies with a dotted leader to the part count. The line-art thumbnail
 * widens on hover or focus, pulling the leader in after it.
 */
export async function CategoryIndex({ categories, locale }: { categories: CategoryNode[]; locale: Locale }) {
  const t = await getTranslations("store.home");
  return (
    <section aria-labelledby="home-categories" className="container-page">
      <SheetHeading id="home-categories" n={1} title={t("categoriesTitle")} href="/shop" linkLabel={t("allParts")} className="mb-7" />
      <ol className="grid grid-cols-1 gap-x-12 lg:grid-cols-2">
        {categories.map((c, i) => {
          const subs = c.children.filter((k) => k.isActive && k.productCount > 0);
          return (
            <li key={c.id} className="min-w-0 border-b border-border first:border-t lg:[&:nth-child(2)]:border-t">
              <Link href={`/category/${c.slug}`} className="group flex items-center gap-3 py-3 outline-offset-[-2px] sm:gap-4">
                <span className="mono w-7 shrink-0 text-[0.8125rem] font-medium text-subtle transition-colors group-hover:text-primary-text">{String(i + 1).padStart(2, "0")}</span>
                <span aria-hidden className="relative block h-12 w-[4.5rem] shrink-0 overflow-hidden border border-border-strong bg-inverse transition-[width,border-color] duration-500 ease-[var(--ease-out-expo)] group-hover:w-32 group-hover:border-primary group-focus-visible:w-32">
                  {c.image ? <Image src={c.image} alt="" fill sizes="128px" unoptimized className="object-cover" /> : null}
                </span>
                <span className="min-w-0 flex-1 sm:flex-initial">
                  <span className="block truncate font-display text-[1.5rem] font-bold uppercase leading-none tracking-wide text-foreground transition-colors group-hover:text-primary-text">{localize(c.name, locale)}</span>
                  <span className="mt-1 block truncate text-[0.8125rem] text-muted">{subs.slice(0, 3).map((s) => localize(s.name, locale)).join(" · ")}{subs.length > 3 ? " …" : ""}</span>
                </span>
                <span aria-hidden className="mx-1 mb-1 hidden min-w-6 flex-1 self-end border-b-2 border-dotted border-border-strong sm:block" />
                <span className="num ml-auto shrink-0 font-display text-[1.5rem] font-bold leading-none text-foreground sm:ml-0">
                  {c.productCount}
                  <span className="sr-only"> {t("partsSr")}</span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-subtle transition-transform duration-300 group-hover:translate-x-1 group-hover:text-primary-text" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ 02 deals as a parts list */

function StockMark({ status, t }: { status: ProductSummary["stockStatus"]; t: Awaited<ReturnType<typeof getTranslations>> }) {
  const tone = status === "in_stock" ? "text-success" : status === "low_stock" ? "text-warning" : "text-danger";
  return (
    <span className={cn("tag-mono inline-flex items-center gap-1.5", tone)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {status === "in_stock" ? t("inStock") : status === "low_stock" ? t("lowStock") : t("outOfStock")}
    </span>
  );
}

type Translator = Awaited<ReturnType<typeof getTranslations>>;

function FitMark({ product, tc }: { product: ProductSummary; tc: Translator }) {
  if (product.fitsSelectedVehicle === true) {
    return (
      <Badge tone="success" className="gap-1 px-1.5 py-1 text-[0.6875rem]">
        <Check className="size-3" strokeWidth={3} aria-hidden />
        {tc("fits")}
      </Badge>
    );
  }
  if (product.fitsSelectedVehicle === false) {
    return (
      <Badge tone="danger" className="gap-1 px-1.5 py-1 text-[0.6875rem]">
        <X className="size-3" strokeWidth={3} aria-hidden />
        {tc("doesNotFit")}
      </Badge>
    );
  }
  return (
    <span aria-hidden className="text-subtle">
      &ndash;
    </span>
  );
}

/**
 * Deals as a dense, ruled parts list: part no., part, spec, fit, price, stock, action. From md up it is a table; on phones
 * each row becomes a stacked entry (part no. and name, then price with its strike-through and discount, then stock and the
 * action) so the price is never off-screen. The trailing action is always "View"; quick-add appears on hover or focus for
 * pointer devices and is left out on touch, where the product page is one tap away.
 */
export async function DealsList({ products, ctx, limit = 6 }: { products: ProductSummary[]; ctx: StoreContext; limit?: number }) {
  const t = await getTranslations("store.home");
  const tc = await getTranslations("store.card");
  if (products.length === 0) return null;
  const rows = products.slice(0, limit);
  // The spec column earns its width only when most rows have something to say.
  const showSpec = rows.filter((p) => p.highlights.length > 0).length * 2 >= rows.length;
  const fitCell = ctx.hasVehicle;
  const viewLink = (p: ProductSummary) => (
    <Link href={`/product/${p.slug}`} className="tag-mono inline-flex min-h-11 items-center gap-1 text-foreground underline-offset-4 hover:text-primary-text hover:underline">
      {t("view")}
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
  return (
    <section aria-labelledby="home-deals" className="container-page">
      <SheetHeading id="home-deals" n={2} title={t("dealsTitle")} href="/deals" linkLabel={t("allDeals")} className="mb-2" />
      <p className="mb-6 max-w-xl text-muted">{t("dealsBody")}</p>

      {/* phones: stacked entries */}
      <ul className="divide-y divide-border border-y-2 border-foreground md:hidden">
        {rows.map((p) => {
          const name = localize(p.name, ctx.locale);
          const pct = p.compareAtFrom ? discountPercent(p.priceFrom, p.compareAtFrom) : 0;
          return (
            <li key={p.id} className="relative flex gap-3 py-4">
              <ProductThumb src={p.image?.url} alt="" className="size-16 shrink-0" sizes="64px" />
              <div className="min-w-0 flex-1">
                <p className="part-no text-[0.8125rem]">{p.partNumber}</p>
                <Link href={`/product/${p.slug}`} className="mt-0.5 block text-[0.9375rem] font-semibold leading-snug text-foreground after:absolute after:inset-0 hover:underline hover:underline-offset-4">
                  {name}
                </Link>
                <p className="text-[0.8125rem] text-muted">{p.brand.name}</p>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Price amount={p.priceFrom} compareAt={p.compareAtFrom} locale={ctx.locale} currency={ctx.currency} size="md" />
                  {pct > 0 ? <span className="tag-mono text-primary-text">-{pct}%</span> : null}
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <StockMark status={p.stockStatus} t={tc} />
                    {fitCell && p.fitsSelectedVehicle !== undefined ? <FitMark product={p} tc={tc} /> : null}
                  </span>
                  <span className="relative z-10">{viewLink(p)}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* md and up: the ruled table */}
      <div className="relative hidden border-y-2 border-foreground md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{t("dealsTitle")}</caption>
          <thead>
            <tr className="border-b border-border-strong text-muted">
              {[t("colPartNo"), t("colPart"), showSpec ? t("colSpec") : null, fitCell ? t("colFit") : null, t("colPrice"), t("colStock"), "action"].map((h, i) => {
                if (i === 2 && !showSpec) return null;
                if (i === 3 && !fitCell) return null;
                return (
                  <th key={i} scope="col" className={cn("tag-mono whitespace-nowrap px-3 py-2.5 font-medium first:pl-0 last:pr-0", i === 4 && "text-right", i === 2 && "hidden lg:table-cell")}>
                    {h === "action" ? <span className="sr-only">{t("colAdd")}</span> : h}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((p) => {
              const name = localize(p.name, ctx.locale);
              const pct = p.compareAtFrom ? discountPercent(p.priceFrom, p.compareAtFrom) : 0;
              const strip = p.highlights.map((h) => localize(h, ctx.locale)).join(" · ");
              const canQuickAdd = p.variantCount === 1 && p.stockStatus !== "out_of_stock";
              return (
                <tr key={p.id} className="group relative transition-colors hover:bg-surface-sunken">
                  <td className="whitespace-nowrap py-3 pl-0 pr-3 align-middle">
                    <span className="part-no text-[0.9375rem]">{p.partNumber}</span>
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <div className="flex items-center gap-3">
                      <ProductThumb src={p.image?.url} alt="" className="size-12" sizes="48px" />
                      <div className="min-w-0">
                        <Link href={`/product/${p.slug}`} className="line-clamp-2 text-[0.9375rem] font-semibold leading-snug text-foreground after:absolute after:inset-0 hover:underline hover:underline-offset-4">
                          {name}
                        </Link>
                        <p className="text-[0.8125rem] text-muted">{p.brand.name}</p>
                      </div>
                    </div>
                  </td>
                  {showSpec ? <td className="tag-mono hidden max-w-44 px-3 py-3 align-middle text-muted lg:table-cell">{strip}</td> : null}
                  {fitCell ? (
                    <td className="px-3 py-3 align-middle">
                      <FitMark product={p} tc={tc} />
                    </td>
                  ) : null}
                  <td className="whitespace-nowrap px-3 py-3 text-right align-middle">
                    <Price amount={p.priceFrom} compareAt={p.compareAtFrom} locale={ctx.locale} currency={ctx.currency} size="md" className="justify-end" />
                    {pct > 0 ? <p className="tag-mono mt-1 text-primary-text">-{pct}%</p> : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 align-middle">
                    <StockMark status={p.stockStatus} t={tc} />
                  </td>
                  <td className="relative z-10 whitespace-nowrap py-2 pl-3 pr-0 text-right align-middle">
                    <div className="flex items-center justify-end gap-2">
                      {canQuickAdd ? (
                        <span className="opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:hidden">
                          <QuickAddButton variantId={p.defaultVariantId} productName={name} />
                        </span>
                      ) : null}
                      {viewLink(p)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ 03 best sellers as a ranking */

export async function BestSellerRanking({ products, ctx, limit = 5 }: { products: ProductSummary[]; ctx: StoreContext; limit?: number }) {
  const t = await getTranslations("store.home");
  if (products.length === 0) return null;
  const [lead, ...rest] = products.slice(0, limit);
  if (!lead) return null;
  const leadName = localize(lead.name, ctx.locale);
  return (
    <section aria-labelledby="home-best" className="container-page">
      <SheetHeading id="home-best" n={3} title={t("bestTitle")} href="/shop?sort=bestselling" linkLabel={t("allParts")} className="mb-7" />
      <div className="grid gap-x-12 gap-y-2 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <ol>
          <li className="group relative flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end lg:flex-col lg:items-stretch lg:border-b-0 lg:pb-0">
            <span aria-hidden className="num font-display text-[5rem] font-extrabold leading-[0.8] text-primary lg:text-[8.5rem]">
              01
            </span>
            <ProductThumb src={lead.image?.url} alt="" className="aspect-square w-full sm:max-w-56 lg:max-w-none" sizes="(min-width: 1024px) 40vw, 224px" />
            <div className="min-w-0 sm:flex-1">
              <p className="part-no text-[0.8125rem] text-muted">{lead.partNumber}</p>
              <Link href={`/product/${lead.slug}`} className="mt-0.5 block text-xl font-semibold leading-snug text-foreground after:absolute after:inset-0 hover:underline hover:underline-offset-4">
                {leadName}
              </Link>
              <div className="mt-2 flex items-center gap-4">
                <Price amount={lead.priceFrom} compareAt={lead.compareAtFrom} locale={ctx.locale} currency={ctx.currency} size="lg" />
                {lead.variantCount === 1 && lead.stockStatus !== "out_of_stock" ? (
                  <span className="relative z-10">
                    <QuickAddButton variantId={lead.defaultVariantId} productName={leadName} />
                  </span>
                ) : null}
              </div>
            </div>
          </li>
        </ol>
        <ol start={2} className="divide-y divide-border border-t border-border lg:flex lg:flex-col lg:border-t-0">
          {rest.map((p, i) => {
            const name = localize(p.name, ctx.locale);
            return (
              <li key={p.id} className="group relative flex items-center gap-4 py-4 first:pt-0 sm:gap-6 lg:flex-1 lg:first:pt-4">
                <span aria-hidden className="num w-14 shrink-0 font-display text-[3.5rem] font-extrabold leading-[0.8] text-border-strong transition-colors duration-300 group-hover:text-primary">
                  {String(i + 2).padStart(2, "0")}
                </span>
                <ProductThumb src={p.image?.url} alt="" className="size-20 shrink-0 sm:size-24 lg:size-28" sizes="112px" />
                <div className="min-w-0 flex-1">
                  <p className="part-no text-[0.8125rem] text-muted">{p.partNumber}</p>
                  <Link href={`/product/${p.slug}`} className="mt-0.5 line-clamp-2 text-[0.9375rem] font-semibold leading-snug text-foreground after:absolute after:inset-0 hover:underline hover:underline-offset-4">
                    {name}
                  </Link>
                  <Price amount={p.priceFrom} compareAt={p.compareAtFrom} locale={ctx.locale} currency={ctx.currency} size="md" className="mt-1.5" />
                </div>
                {p.variantCount === 1 && p.stockStatus !== "out_of_stock" ? (
                  <div className="relative z-10 shrink-0">
                    <QuickAddButton variantId={p.defaultVariantId} productName={name} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ 04 new arrivals, asymmetric */

/** New arrivals: the newest part gets a 2 x 2 plate, the next four fill the rest of the grid. */
export async function NewArrivals({ products, ctx }: { products: ProductSummary[]; ctx: StoreContext }) {
  const t = await getTranslations("store.home");
  if (products.length === 0) return null;
  const [lead, ...rest] = products;
  if (!lead) return null;
  const card = (p: ProductSummary, priority?: boolean) => (
    <ProductCard key={p.id} product={p} locale={ctx.locale} currency={ctx.currency} signedIn={Boolean(ctx.user)} inWishlist={ctx.wishlistIds.has(p.id)} {...(priority ? { priority } : {})} />
  );
  return (
    <section aria-labelledby="home-new" className="container-page">
      <SheetHeading id="home-new" n={4} title={t("newTitle")} href="/shop?sort=newest" linkLabel={t("allParts")} className="mb-7" />
      <div className="grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-4">
        <div className="col-span-2 self-start md:row-span-2">{card(lead)}</div>
        {rest.slice(0, 4).map((p) => card(p))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ promo banners */

export async function PromoBanners({ banners, locale }: { banners: Banner[]; locale: Locale }) {
  const t = await getTranslations("store.home");
  if (banners.length === 0) return null;
  return (
    <section aria-label={t("promosLabel")} className="container-page">
      <ul className={cn("grid gap-4", banners.length > 1 && "md:grid-cols-2")}>
        {banners.slice(0, 2).map((b) => (
          <li key={b.id}>
            <SmartLink
              href={b.ctaHref}
              className="reg-marks group relative isolate flex min-h-60 flex-col justify-end overflow-hidden border border-inverse-border bg-inverse p-6 text-inverse-foreground [--reg-c:var(--inverse-muted)] md:min-h-64 md:p-8"
            >
              {b.image ? (
                <span aria-hidden className="absolute inset-y-0 right-0 -z-10 w-full opacity-25 md:w-[58%] md:opacity-100">
                  <Image
                    src={b.image}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 30vw, 100vw"
                    unoptimized
                    className="object-cover object-right transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.03]"
                  />
                </span>
              ) : null}
              <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-inverse via-inverse/85 to-transparent" />
              <span className="max-w-xs space-y-2">
                <span className="display-3 block">{localize(b.title, locale)}</span>
                <span className="block text-inverse-muted">{localize(b.subtitle, locale)}</span>
                <span className="mt-3 inline-flex items-center gap-2 font-display text-[0.9375rem] font-semibold uppercase tracking-[0.07em] text-primary">
                  {localize(b.ctaLabel, locale)}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </span>
              </span>
            </SmartLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ 05 brand index */

/** Brands as a typeset index: NAME ........ COUNTRY / N parts. Quieter than a wall of logo boxes and it carries data. */
export async function BrandIndex({ brands, locale }: { brands: (Brand & { productCount: number })[]; locale: Locale }) {
  const t = await getTranslations("store.home");
  if (brands.length === 0) return null;
  const regions = new Intl.DisplayNames([locale], { type: "region" });
  const countryName = (code?: string) => {
    if (!code) return "";
    try {
      return regions.of(code) ?? code;
    } catch {
      return code;
    }
  };
  return (
    <section aria-labelledby="home-brands" className="container-page">
      <SheetHeading id="home-brands" n={5} title={t("brandsTitle")} href="/brands" linkLabel={t("allBrands")} className="mb-7" />
      <ul className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
        {brands.slice(0, 12).map((b) => (
          <li key={b.id} className="border-b border-border">
            <Link href={`/brand/${b.slug}`} className="group flex min-h-12 items-baseline gap-3 py-3">
              <span className="font-display text-[1.375rem] font-bold uppercase leading-none tracking-wide text-foreground transition-colors group-hover:text-primary-text">{b.name}</span>
              {b.country ? (
                <span className="tag-mono text-muted" title={countryName(b.country)}>
                  {b.country}
                  <span className="sr-only"> ({countryName(b.country)})</span>
                </span>
              ) : null}
              <span aria-hidden className="mb-1 min-w-4 flex-1 self-end border-b-2 border-dotted border-border-strong" />
              <span className="tag-mono shrink-0 text-foreground">{t("brandParts", { count: b.productCount })}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
