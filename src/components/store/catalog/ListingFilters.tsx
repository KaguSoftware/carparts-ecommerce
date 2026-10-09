"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, SlidersHorizontal, Star } from "lucide-react";
import { Button, Checkbox, Input, Modal, Select } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import type { CurrencyContext } from "@/lib/money";
import type { ProductSort } from "@/lib/services/contracts";
import { cn } from "@/lib/utils";
import { SORT_OPTIONS, listingHref, type ListingParams } from "./listing-params";

export interface FilterFacets {
  brands: { slug: string; name: string; count: number }[];
  categories: { slug: string; name: string; count: number; href: string }[];
  priceRange: { min: number; max: number };
  inStockCount: number;
  onSaleCount: number;
  ratings: { rating: number; count: number }[];
}

export interface FilterProps {
  basePath: string;
  params: ListingParams;
  facets: FilterFacets;
  currency: CurrencyContext;
  showBrands: boolean;
  showCategories: boolean;
}

function useNavigateListing(basePath: string, params: ListingParams) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const go = (patch: Partial<ListingParams>) => {
    startTransition(() => {
      router.push(listingHref(basePath, { ...params, ...patch, page: 1 }), { scroll: false });
    });
  };
  return { go, pending };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId().replace(/:/g, "");
  return (
    <div role="group" aria-labelledby={id} className="border-t border-border pt-5 first:border-t-0 first:pt-0">
      <p id={id} className="mb-3 font-sans text-[0.9375rem] font-semibold tracking-normal text-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

/** Brands shown before "Show all": the list is long and the sidebar should not need its own scrolling to be usable. */
const BRANDS_COLLAPSED = 6;

function FilterForm({ basePath, params, facets, currency, showBrands, showCategories }: FilterProps) {
  const t = useTranslations("store.listing");
  const uid = useId().replace(/:/g, "");
  const { go, pending } = useNavigateListing(basePath, params);

  const rate = currency.rate;
  const toDisplay = (cents: number | undefined) => (cents === undefined ? "" : String(Math.round((cents * rate) / 100)));
  const [allBrands, setAllBrands] = useState(false);
  const [min, setMin] = useState(toDisplay(params.minPrice));
  const [max, setMax] = useState(toDisplay(params.maxPrice));
  // Reset the draft price inputs when the URL changes underneath them (chips, back button).
  const [lastPrice, setLastPrice] = useState(`${params.minPrice}|${params.maxPrice}`);
  const priceKey = `${params.minPrice}|${params.maxPrice}`;
  if (priceKey !== lastPrice) {
    setLastPrice(priceKey);
    setMin(toDisplay(params.minPrice));
    setMax(toDisplay(params.maxPrice));
  }

  const toCents = (value: string): number | undefined => {
    const n = Number(value.replace(",", "."));
    return value.trim() !== "" && Number.isFinite(n) && n >= 0 ? Math.round((n * 100) / rate) : undefined;
  };

  function applyPrice(e: FormEvent) {
    e.preventDefault();
    const lo = toCents(min);
    const hi = toCents(max);
    go({ ...(lo !== undefined ? { minPrice: lo } : { minPrice: undefined }), ...(hi !== undefined ? { maxPrice: hi } : { maxPrice: undefined }) });
  }

  const toggleBrand = (slug: string) => {
    const next = params.brands.includes(slug) ? params.brands.filter((b) => b !== slug) : [...params.brands, slug];
    go({ brands: next });
  };

  const currencySymbol = new Intl.NumberFormat(currency.currency === "TRY" ? "tr-TR" : "en-US", { style: "currency", currency: currency.currency, maximumFractionDigits: 0 })
    .formatToParts(0)
    .find((p) => p.type === "currency")?.value;

  return (
    <div className={cn("space-y-6", pending && "opacity-70 transition-opacity")} aria-busy={pending}>
      {showCategories && facets.categories.length > 0 ? (
        <Section title={t("categories")}>
          <ul className="space-y-0.5">
            {facets.categories.slice(0, 12).map((c) => (
              <li key={c.slug}>
                <Link href={c.href} className="flex min-h-9 items-center justify-between gap-3 rounded-xs text-[0.9375rem] text-foreground hover:text-primary-text hover:underline hover:underline-offset-4">
                  <span className="truncate">{c.name}</span>
                  <span className="num text-[0.8125rem] text-subtle">{c.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {showBrands && facets.brands.length > 0 ? (
        <Section title={t("brands")}>
          <ul className="space-y-2">
            {/* collapsed: the first few, plus any brand that is already selected so an active filter is never hidden */}
            {facets.brands
              .filter((b, i) => allBrands || i < BRANDS_COLLAPSED || params.brands.includes(b.slug))
              .map((b) => (
              <li key={b.slug}>
                <Checkbox
                  checked={params.brands.includes(b.slug)}
                  onChange={() => toggleBrand(b.slug)}
                  label={
                    <span className="flex items-baseline justify-between gap-3">
                      <span>{b.name}</span>
                      <span className="num text-[0.8125rem] text-subtle">{b.count}</span>
                    </span>
                  }
                  className="[&>span:last-child]:flex-1"
                />
              </li>
            ))}
          </ul>
          {facets.brands.length > BRANDS_COLLAPSED ? (
            <button
              type="button"
              aria-expanded={allBrands}
              onClick={() => setAllBrands((v) => !v)}
              className="mt-3 inline-flex min-h-9 items-center gap-1.5 text-[0.875rem] font-medium text-primary-text underline underline-offset-4 hover:no-underline"
            >
              {allBrands ? t("showFewerBrands") : t("showAllBrands", { count: facets.brands.length })}
              <ChevronDown className={cn("size-4 transition-transform", allBrands && "rotate-180")} aria-hidden />
            </button>
          ) : null}
        </Section>
      ) : null}

      <Section title={t("price")}>
        <form onSubmit={applyPrice} className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor={`${uid}-min`} className="mb-1 block text-[0.8125rem] text-muted">
                {t("priceMin")}
              </label>
              <Input id={`${uid}-min`} inputMode="numeric" size="sm" value={min} onChange={(e) => setMin(e.target.value.replace(/[^\d.,]/g, ""))} placeholder={toDisplay(facets.priceRange.min)} leading={<span className="text-[0.8125rem]">{currencySymbol}</span>} />
            </div>
            <div>
              <label htmlFor={`${uid}-max`} className="mb-1 block text-[0.8125rem] text-muted">
                {t("priceMax")}
              </label>
              <Input id={`${uid}-max`} inputMode="numeric" size="sm" value={max} onChange={(e) => setMax(e.target.value.replace(/[^\d.,]/g, ""))} placeholder={toDisplay(facets.priceRange.max)} leading={<span className="text-[0.8125rem]">{currencySymbol}</span>} />
            </div>
          </div>
          <Button type="submit" variant="outline" size="sm" fullWidth>
            {t("applyPrice")}
          </Button>
        </form>
      </Section>

      <Section title={t("availability")}>
        <ul className="space-y-2">
          <li>
            <Checkbox
              checked={params.inStock}
              onChange={() => go({ inStock: !params.inStock })}
              label={
                <span className="flex items-baseline justify-between gap-3">
                  <span>{t("inStock")}</span>
                  <span className="num text-[0.8125rem] text-subtle">{facets.inStockCount}</span>
                </span>
              }
              className="[&>span:last-child]:flex-1"
            />
          </li>
          <li>
            <Checkbox
              checked={params.onSale}
              onChange={() => go({ onSale: !params.onSale })}
              label={
                <span className="flex items-baseline justify-between gap-3">
                  <span>{t("onSale")}</span>
                  <span className="num text-[0.8125rem] text-subtle">{facets.onSaleCount}</span>
                </span>
              }
              className="[&>span:last-child]:flex-1"
            />
          </li>
        </ul>
      </Section>

      <Section title={t("rating")}>
        <ul className="space-y-1">
          {facets.ratings
            .filter((r) => r.rating >= 2)
            .map((r) => {
              const selected = params.minRating === r.rating;
              return (
                <li key={r.rating}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => go({ ...(selected ? { minRating: undefined } : { minRating: r.rating }) })}
                    className={cn(
                      "flex min-h-9 w-full items-center justify-between gap-3 rounded-xs px-1.5 text-[0.9375rem] hover:bg-surface-sunken",
                      selected && "bg-primary-soft font-semibold",
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="flex" aria-hidden>
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star key={i} className={cn("size-4", i < r.rating ? "fill-accent text-accent" : "text-border-strong")} />
                        ))}
                      </span>
                      <span>{t("ratingAndUp", { rating: r.rating })}</span>
                    </span>
                    <span className="num text-[0.8125rem] text-subtle">{r.count}</span>
                  </button>
                </li>
              );
            })}
        </ul>
      </Section>
    </div>
  );
}

/**
 * Desktop sidebar (hidden below lg). It is sticky and can be taller than the viewport, so it scrolls on its own: the
 * scrollbar is thin but visible, its gutter is reserved (no sideways jump), and a fade on the bottom edge says there is
 * more below for as long as there is.
 */
export function FiltersSidebar(props: FilterProps) {
  const t = useTranslations("store.listing");
  const scroller = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const measure = useCallback(() => {
    const el = scroller.current;
    if (el) setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  }, []);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [measure]);
  return (
    <aside aria-label={t("filters")} className="hidden lg:block">
      <div
        ref={scroller}
        onScroll={measure}
        className={cn(
          "sticky top-32 max-h-[calc(100dvh-9rem)] overflow-y-auto pr-3 [scrollbar-color:var(--border-strong)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin]",
          more && "[mask-image:linear-gradient(to_bottom,black_calc(100%-3rem),transparent)]",
        )}
      >
        <FilterForm {...props} />
      </div>
    </aside>
  );
}

/** Mobile "Filters" button + drawer (hidden from lg up). */
export function FiltersDrawer({ activeCount, ...props }: FilterProps & { activeCount: number }) {
  const t = useTranslations("store.listing");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="lg:hidden" leftIcon={<SlidersHorizontal className="size-4" aria-hidden />} aria-haspopup="dialog">
        {t("filters")}
        {activeCount > 0 ? <span className="num ml-0.5 rounded-xs bg-primary px-1.5 py-0.5 text-[0.75rem] leading-none text-primary-foreground">{activeCount}</span> : null}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} placement="left" title={t("filters")} footer={<Button onClick={() => setOpen(false)}>{t("showResults")}</Button>}>
        <FilterForm {...props} />
      </Modal>
    </>
  );
}

/** Sort dropdown; writes `sort` to the URL. */
export function SortSelect({ basePath, params }: { basePath: string; params: ListingParams }) {
  const t = useTranslations("store.listing");
  const uid = useId().replace(/:/g, "");
  const { go, pending } = useNavigateListing(basePath, params);
  return (
    <div className="flex items-center gap-2.5">
      <label htmlFor={`sort-${uid}`} className="whitespace-nowrap text-sm font-medium text-muted">
        {t("sortBy")}
      </label>
      <Select
        id={`sort-${uid}`}
        size="sm"
        value={params.sort}
        disabled={pending}
        onChange={(e) => go({ sort: e.target.value as ProductSort })}
        wrapperClassName="min-w-44"
      >
        {SORT_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {params.q && s === "featured" ? t("sort.relevance") : t(`sort.${s}`)}
          </option>
        ))}
      </Select>
    </div>
  );
}
