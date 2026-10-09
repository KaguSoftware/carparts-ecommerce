import { useTranslations } from "next-intl";
import { PartNo } from "@/components/shared/PartPlate";
import { ProductThumb } from "@/components/store/product/ProductThumb";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/i18n-string";
import { formatMinor, formatMoney, type CurrencyContext } from "@/lib/money";
import type { CartLine, LocalizedString } from "@/lib/types/domain";
import { cn } from "@/lib/utils";
import { CouponSection } from "./CouponSection";

export interface SummaryTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
}

export interface OrderSummaryPanelProps {
  lines: CartLine[];
  totals: SummaryTotals;
  couponCode?: string;
  /** False until a shipping method has been quoted: shipping and total are then provisional. */
  shippingChosen: boolean;
  taxName?: LocalizedString;
  taxRateBps?: number;
  /** What will actually be charged, in display currency minor units. */
  charge?: { amount: number; currency: "USD" | "TRY" };
  locale: string;
  currency: CurrencyContext;
  loading?: boolean;
  /** When given, the discount-code box is shown inside the slip and calls this after a code is applied or removed. */
  onCouponChanged?: () => void;
  className?: string;
}

/** Read-only order summary used beside the checkout form (desktop) and in the collapsible bar (mobile). */
export function OrderSummaryPanel({ lines, totals, couponCode, shippingChosen, taxName, taxRateBps, charge, locale, currency, loading, onCouponChanged, className }: OrderSummaryPanelProps) {
  const t = useTranslations("checkout.summary");
  const money = (cents: number) => formatMoney(cents, locale, currency);
  const row = "flex items-baseline justify-between gap-4";
  const units = lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <div className={className}>
      <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-dashed border-border-strong pb-3">
        <h2 className="display-4">{t("title")}</h2>
        <Link href="/cart" className="text-sm font-medium text-primary-text underline-offset-4 hover:underline">
          {t("editCart")}
        </Link>
      </div>

      <ul className="divide-y divide-border border-y border-border" aria-label={t("itemsLabel", { count: units })}>
        {lines.map((line) => (
          <li key={line.variantId} className="flex gap-3 py-3.5">
            <ProductThumb src={line.image} alt="" className="size-14 shrink-0" sizes="56px" />
            <div className="min-w-0 flex-1">
              <PartNo className="block text-[0.8125rem] text-foreground">{line.partNumber}</PartNo>
              <p className="line-clamp-2 text-sm font-medium leading-snug">{localize(line.name, locale)}</p>
              <p className="mono mt-0.5 truncate text-[0.75rem] text-muted">
                <span className="sr-only">{t("quantity")}</span>
                {"× "}
                {line.quantity} · {localize(line.variantName, locale)}
              </p>
            </div>
            <p className="mono shrink-0 text-sm font-semibold">{money(line.lineTotal)}</p>
          </li>
        ))}
      </ul>

      {onCouponChanged ? (
        <div className="mt-4">
          <p className="tag-mono mb-1.5 text-muted">{t("coupon")}</p>
          <CouponSection currency={currency} {...(couponCode ? { appliedCode: couponCode } : {})} onChanged={onCouponChanged} />
        </div>
      ) : null}

      <dl className={cn("mt-4 space-y-2.5 text-[0.9375rem] transition-opacity", loading && "opacity-60")} aria-busy={loading || undefined}>
        <div className={row}>
          <dt className="text-muted">{t("subtotal")}</dt>
          <dd className="mono font-medium">{money(totals.subtotal)}</dd>
        </div>
        {totals.discount > 0 ? (
          <div className={row}>
            <dt className="text-success">{couponCode ? t("discountWithCode", { code: couponCode }) : t("discount")}</dt>
            <dd className="mono font-medium text-success">-{money(totals.discount)}</dd>
          </div>
        ) : null}
        <div className={row}>
          <dt className="text-muted">{t("shipping")}</dt>
          <dd className="mono font-medium">{shippingChosen ? (totals.shipping === 0 ? t("free") : money(totals.shipping)) : <span className="font-normal text-muted">{t("shippingPending")}</span>}</dd>
        </div>
        <div className={row}>
          <dt className="text-muted">
            {t("tax")}
            {taxName && taxRateBps ? <span className="ml-1.5 text-[0.8125rem] text-subtle">({localize(taxName, locale)} {(taxRateBps / 100).toFixed(2).replace(/\.?0+$/, "")}%)</span> : null}
          </dt>
          <dd className="mono font-medium">{money(totals.tax)}</dd>
        </div>
        <div className={cn(row, "border-t-2 border-foreground pt-3")}>
          <dt className="font-display text-lg font-bold uppercase tracking-wide">{t("total")}</dt>
          <dd className="mono text-2xl font-bold leading-none">{money(totals.total)}</dd>
        </div>
      </dl>
      {charge && charge.currency !== "USD" ? (
        <p className="mt-3 text-[0.8125rem] text-muted">{t("chargeNote", { amount: formatMinor(charge.amount, charge.currency, locale), currency: charge.currency })}</p>
      ) : null}
    </div>
  );
}
