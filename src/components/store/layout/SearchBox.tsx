"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpRight, Layers, Search, Tag, X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { localize } from "@/lib/i18n-string";
import { formatMoney, type CurrencyContext } from "@/lib/money";
import type { SearchSuggestions } from "@/lib/services/contracts";
import { cn } from "@/lib/utils";
import { ProductThumb } from "../product/ProductThumb";

type Option =
  | { kind: "exact"; key: string; href: string; label: string }
  | { kind: "product"; key: string; href: string; name: string; brand: string; image?: string; price: number; partNumber: string }
  | { kind: "category"; key: string; href: string; label: string }
  | { kind: "brand"; key: string; href: string; label: string };

export function SearchBox({ locale, currency, className }: { locale: "en" | "tr"; currency: CurrencyContext; className?: string }) {
  const t = useTranslations("store.search");
  const router = useRouter();
  const uid = useId().replace(/:/g, "");
  const listId = `sb-${uid}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SearchSuggestions | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);

  const query = value.trim();

  useEffect(() => {
    if (query.length < 2) return;
    const ctrl = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(query)}&locale=${locale}&limit=6`, { signal: ctrl.signal });
        if (res.ok) {
          setData((await res.json()) as SearchSuggestions);
          setActive(-1);
        }
      } catch {
        /* aborted or offline: keep the previous suggestions */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, locale]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const fresh = query.length >= 2 && data?.query.toLowerCase() === query.toLowerCase().replace(/\s+/g, " ") ? data : null;

  const options = useMemo<Option[]>(() => {
    if (!fresh) return [];
    const list: Option[] = [];
    if (fresh.exactMatch) list.push({ kind: "exact", key: "exact", href: `/product/${fresh.exactMatch.slug}`, label: fresh.query });
    for (const p of fresh.products) {
      list.push({
        kind: "product",
        key: `p-${p.id}`,
        href: `/product/${p.slug}`,
        name: localize(p.name, locale),
        brand: p.brand.name,
        ...(p.image ? { image: p.image.url } : {}),
        price: p.priceFrom,
        partNumber: p.partNumber,
      });
    }
    for (const c of fresh.categories) list.push({ kind: "category", key: `c-${c.id}`, href: `/category/${c.slug}`, label: localize(c.name, locale) });
    for (const b of fresh.brands) list.push({ kind: "brand", key: `b-${b.id}`, href: `/brand/${b.slug}`, label: b.name });
    return list;
  }, [fresh, locale]);

  const showPanel = open && query.length >= 2;
  const optionId = (i: number) => `sb-${uid}-opt-${i}`;

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function submit() {
    const chosen = active >= 0 ? options[active] : undefined;
    if (chosen) return go(chosen.href);
    if (query) go(`/search?q=${encodeURIComponent(query)}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && options.length) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % options.length);
    } else if (e.key === "ArrowUp" && options.length) {
      e.preventDefault();
      setActive((a) => (a <= 0 ? options.length - 1 : a - 1));
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      }
    }
  }

  const sectionOf = (i: number) => (i === 0 || options[i - 1]?.kind !== options[i]?.kind ? options[i]?.kind : null);
  const sectionLabel: Record<Option["kind"], string> = {
    exact: t("partMatch"),
    product: t("products"),
    category: t("categories"),
    brand: t("brands"),
  };

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <form
        role="search"
        aria-label={t("label")}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="relative"
      >
        <label htmlFor={`sb-${uid}`} className="sr-only">
          {t("label")}
        </label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-subtle" aria-hidden />
        <input
          ref={inputRef}
          id={`sb-${uid}`}
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? optionId(active) : undefined}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="search"
          placeholder={t("placeholder")}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="h-12 w-full rounded-sm border border-transparent bg-surface pl-11 pr-24 text-base text-foreground placeholder:text-subtle focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary [&::-webkit-search-cancel-button]:hidden"
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              setValue("");
              setData(null);
              inputRef.current?.focus();
            }}
            className="absolute right-12 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-sm text-muted hover:text-foreground"
            aria-label={t("clear")}
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
        <button
          type="submit"
          aria-label={t("submit")}
          className="absolute right-1 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-sm bg-primary text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          <Search className="size-5" aria-hidden />
        </button>
      </form>

      <div
        id={listId}
        role="listbox"
        aria-label={t("suggestions")}
        hidden={!showPanel}
        className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(34rem,70dvh)] overflow-y-auto rounded-md border border-border bg-surface-raised text-foreground shadow-lg"
      >
        {showPanel && !fresh ? (
          <p className="px-4 py-5 text-sm text-muted" role="status">
            {loading ? t("searching") : t("typeMore")}
          </p>
        ) : null}
        {showPanel && fresh && options.length === 0 ? (
          <div className="px-4 py-5 text-sm" role="status">
            <p className="font-semibold">{t("noResults", { query })}</p>
            <p className="mt-1 text-muted">{t("noResultsHint")}</p>
          </div>
        ) : null}
        {options.map((o, i) => {
          const section = sectionOf(i);
          return (
            <div key={o.key} role="presentation">
              {section ? <p role="presentation" className="label-caps border-t border-border bg-surface-sunken px-4 py-2 text-muted first:border-t-0">{sectionLabel[section]}</p> : null}
              <div
                id={optionId(i)}
                role="option"
                aria-selected={active === i}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(o.href)}
                className={cn("flex cursor-pointer items-center gap-3 px-4 py-2.5", active === i ? "bg-primary-soft" : "hover:bg-surface-sunken")}
              >
                {o.kind === "product" ? (
                  <>
                    <ProductThumb src={o.image} alt="" className="size-12" sizes="48px" />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 block text-[0.9375rem] font-semibold">{o.name}</span>
                      <span className="num block truncate text-[0.8125rem] text-muted">
                        {o.brand} · {o.partNumber}
                      </span>
                    </span>
                    <span className="num shrink-0 text-[0.9375rem] font-bold">{formatMoney(o.price, locale, currency)}</span>
                  </>
                ) : o.kind === "exact" ? (
                  <>
                    <ArrowUpRight className="size-5 shrink-0 text-primary-text" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold">{t("goToPart", { code: o.label })}</span>
                  </>
                ) : (
                  <>
                    {o.kind === "category" ? <Layers className="size-5 shrink-0 text-muted" aria-hidden /> : <Tag className="size-5 shrink-0 text-muted" aria-hidden />}
                    <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-medium">{o.label}</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {showPanel && fresh && options.length > 0 ? (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => go(`/search?q=${encodeURIComponent(query)}`)}
            className="flex w-full items-center justify-between gap-3 border-t border-border bg-surface-sunken px-4 py-3 text-left text-sm font-semibold text-primary-text hover:underline"
          >
            {t("seeAll", { query })}
            <ArrowUpRight className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {showPanel && fresh ? t("resultsAnnounce", { count: options.length }) : ""}
      </p>
    </div>
  );
}
