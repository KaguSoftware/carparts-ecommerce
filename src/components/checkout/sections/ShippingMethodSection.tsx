"use client";

import { useTranslations } from "next-intl";
import { Alert, Skeleton } from "@/components/ui";
import { localize } from "@/lib/i18n-string";
import { formatMoney, type CurrencyContext } from "@/lib/money";
import type { ShippingQuote } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

export interface ShippingMethodSectionProps {
  quotes: ShippingQuote[];
  selectedId: string;
  onSelect: (id: string) => void;
  loading: boolean;
  error?: string;
  locale: string;
  currency: CurrencyContext;
}

/** Radio list of the shipping methods the server quoted for the current destination. */
export function ShippingMethodSection({ quotes, selectedId, onSelect, loading, error, locale, currency }: ShippingMethodSectionProps) {
  const t = useTranslations("checkout.method");

  if (loading && quotes.length === 0) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  if (quotes.length === 0) {
    return <Alert tone="warning">{t("none")}</Alert>;
  }

  return (
    <fieldset className={cn("space-y-3 transition-opacity", loading && "opacity-60")} aria-busy={loading || undefined}>
      <legend className="sr-only">{t("legend")}</legend>
      {quotes.map((quote) => {
        const checked = quote.methodId === selectedId;
        const days =
          quote.estimatedDaysMin === quote.estimatedDaysMax
            ? t("daysSingle", { count: quote.estimatedDaysMin })
            : t("daysRange", { min: quote.estimatedDaysMin, max: quote.estimatedDaysMax });
        return (
          <label
            key={quote.methodId}
            className={cn(
              "flex cursor-pointer items-start gap-3.5 rounded-md border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
              checked ? "border-primary bg-primary-soft" : "border-border-strong hover:border-muted",
            )}
          >
            <input type="radio" name="shippingMethod" value={quote.methodId} checked={checked} onChange={() => onSelect(quote.methodId)} className="mt-1 size-4.5 accent-primary" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{localize(quote.name, locale)}</span>
              <span className="mt-0.5 block text-sm text-muted">{localize(quote.description, locale)}</span>
              <span className="mt-1 block text-[0.8125rem] text-muted">{days}</span>
            </span>
            <span className="num shrink-0 font-display text-lg font-bold">{quote.isFree || quote.price === 0 ? t("free") : formatMoney(quote.price, locale, currency)}</span>
          </label>
        );
      })}
      {error ? (
        <p role="alert" className="text-[0.8125rem] font-medium text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
