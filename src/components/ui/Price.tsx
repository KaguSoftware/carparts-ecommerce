import { cn } from "@/lib/utils";
import { discountPercent, formatMoney, USD_CONTEXT, type CurrencyContext } from "@/lib/money";

export interface PriceProps {
  /** USD minor units (cents). */
  amount: number;
  /** Original price (USD cents) to strike through when higher than `amount`. */
  compareAt?: number | null;
  locale: string;
  currency?: CurrencyContext;
  size?: "sm" | "md" | "lg" | "xl";
  /** Show "-23%" next to a compare-at price. */
  showDiscount?: boolean;
  className?: string;
}

const sizes = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-3xl",
  xl: "text-[2.5rem]",
} as const;

/** Pure presentational price (server or client). Prices always use tabular figures. */
export function Price({ amount, compareAt, locale, currency = USD_CONTEXT, size = "md", showDiscount, className }: PriceProps) {
  const hasCompare = typeof compareAt === "number" && compareAt > amount;
  const pct = hasCompare ? discountPercent(amount, compareAt) : 0;
  return (
    <span className={cn("num inline-flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5", className)}>
      <span className={cn("font-display font-bold leading-none text-foreground", sizes[size])}>{formatMoney(amount, locale, currency)}</span>
      {hasCompare ? (
        <>
          <s className="text-sm text-muted">{formatMoney(compareAt, locale, currency)}</s>
          {showDiscount && pct > 0 ? <span className="label-caps rounded-xs bg-accent px-1.5 py-1 text-[0.75rem] leading-none text-accent-foreground">-{pct}%</span> : null}
        </>
      ) : null}
    </span>
  );
}
