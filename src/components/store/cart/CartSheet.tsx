"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Check, CircleHelp, Globe, Lock, Trash2, X } from "lucide-react";
import { PartPlate } from "@/components/shared/PartPlate";
import { buttonStyles } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { formatMoney, type CurrencyContext } from "@/lib/money";
import { localize } from "@/lib/i18n-string";
import type { CartLine, CartView, ProductSummary } from "@/lib/types/domain";
import { cn } from "@/lib/utils";
import { ProductThumb } from "../product/ProductThumb";
import { QuickAddButton } from "../product/AddToCartButton";
import { useCartStore } from "./cart-store";
import { CartTotalsList, CouponBox, FreeShippingMeter, QuantityStepper, useCartMutations } from "./CartParts";

export type LineFit = "fits" | "does_not_fit" | "universal" | "unknown";

interface SheetProps {
  cart: CartView;
  locale: string;
  currency: CurrencyContext;
  /** Fit verdict per productId for the saved vehicle (empty when no vehicle is saved). */
  fit: Record<string, LineFit>;
  vehicleLabel: string | null;
}

const COLS = "md:grid-cols-[1.75rem_minmax(7.25rem,8.5rem)_minmax(0,1fr)_5.75rem_7.5rem_4.25rem_5rem]";

function FitCell({ fit, vehicleLabel }: { fit: LineFit | undefined; vehicleLabel: string | null }) {
  const t = useTranslations("store.cart.sheet");
  if (!vehicleLabel) {
    return (
      <Link href="/garage" className="tag-mono inline-flex min-h-9 items-center gap-1.5 text-muted underline-offset-4 hover:text-foreground hover:underline">
        <CircleHelp className="size-4 shrink-0" aria-hidden />
        {t("addCar")}
      </Link>
    );
  }
  if (fit === "fits") {
    return (
      <p className="tag-mono flex items-start gap-1.5 text-success">
        <Check className="mt-px size-4 shrink-0" strokeWidth={3} aria-hidden />
        <span>
          {t("fits")}
          <span className="block normal-case tracking-normal text-muted">{vehicleLabel}</span>
        </span>
      </p>
    );
  }
  if (fit === "does_not_fit") {
    return (
      <p className="tag-mono flex items-start gap-1.5 text-danger">
        <X className="mt-px size-4 shrink-0" strokeWidth={3} aria-hidden />
        <span>
          {t("noFit")}
          <span className="block normal-case tracking-normal text-muted">{vehicleLabel}</span>
        </span>
      </p>
    );
  }
  if (fit === "universal") {
    return (
      <p className="tag-mono flex items-center gap-1.5 text-success">
        <Globe className="size-4 shrink-0" aria-hidden />
        {t("universal")}
      </p>
    );
  }
  return (
    <p className="tag-mono flex items-center gap-1.5 text-muted">
      <CircleHelp className="size-4 shrink-0" aria-hidden />
      {t("unknown")}
    </p>
  );
}

/** The cart as a parts requisition: ruled rows of LINE / PART NO. / DESCRIPTION / FITS / QTY / UNIT / TOTAL. */
export function RequisitionTable({ cart, locale, currency, fit, vehicleLabel }: SheetProps) {
  const t = useTranslations("store.cart");
  const ts = useTranslations("store.cart.sheet");
  const { pending, setQuantity, remove } = useCartMutations(currency);
  const { justAdded } = useCartStore();
  const head = "tag-mono hidden px-0 py-2.5 font-medium text-muted md:block";

  return (
    <div role="table" aria-label={ts("label")} className="reg-marks border border-border-strong bg-surface">
      <div role="row" className={cn("hidden border-b-2 border-foreground px-4 md:grid md:gap-x-3", COLS)}>
        <span role="columnheader" className={head}>
          {ts("line")}
        </span>
        <span role="columnheader" className={head}>
          {ts("partNo")}
        </span>
        <span role="columnheader" className={head}>
          {ts("description")}
        </span>
        <span role="columnheader" className={head}>
          {ts("fits")}
        </span>
        <span role="columnheader" className={head}>
          {ts("qty")}
        </span>
        <span role="columnheader" className={cn(head, "text-right")}>
          {ts("unit")}
        </span>
        <span role="columnheader" className={cn(head, "text-right")}>
          {ts("total")}
        </span>
      </div>
      <div role="rowgroup" className="divide-y divide-border">
        {cart.lines.map((line: CartLine, i) => {
          const busy = pending === line.variantId;
          const name = localize(line.name, locale);
          const variant = localize(line.variantName, locale);
          const onSale = line.compareAtPrice !== undefined && line.compareAtPrice > line.unitPrice;
          return (
            <div key={line.variantId} role="row" aria-busy={busy} className={cn("grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 gap-y-3 px-4 py-4 md:items-center md:gap-x-3", COLS, busy && "opacity-60")}>
              <span role="cell" className="mono pt-0.5 text-[0.8125rem] font-medium text-subtle md:pt-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div role="cell" className="col-start-2 min-w-0 md:col-start-auto">
                <PartPlate size="sm" partNumber={line.partNumber} sku={line.sku} stamp={justAdded === line.variantId} stacked />
              </div>
              <div role="cell" className="col-span-2 flex min-w-0 gap-3 md:col-span-1">
                <Link href={`/product/${line.slug}`} className="shrink-0" tabIndex={-1} aria-hidden>
                  <ProductThumb src={line.image} alt="" className="size-14 sm:size-16" sizes="64px" />
                </Link>
                <div className="min-w-0">
                  <Link href={`/product/${line.slug}`} className="text-pretty text-[0.9375rem] font-semibold leading-snug text-foreground underline-offset-4 hover:underline">
                    {name}
                  </Link>
                  <p className="mt-0.5 text-[0.8125rem] text-muted">
                    {line.brandName} · {variant}
                  </p>
                  {line.maxQuantity <= 3 && line.maxQuantity > 0 ? <p className="tag-mono mt-1 text-warning">{t("onlyLeft", { count: line.maxQuantity })}</p> : null}
                </div>
              </div>
              <div role="cell" className="col-span-2 md:col-span-1">
                <FitCell fit={fit[line.productId]} vehicleLabel={vehicleLabel} />
              </div>
              <div role="cell" className="col-span-2 flex flex-wrap items-center justify-between gap-3 md:col-span-1 md:block">
                <QuantityStepper line={line} name={name} busy={busy} compact onChange={(q) => void setQuantity(line.variantId, q)} />
                <button
                  type="button"
                  onClick={() => void remove(line.variantId)}
                  disabled={busy}
                  className="tag-mono inline-flex min-h-9 items-center gap-1.5 px-1 text-muted underline-offset-4 hover:text-danger hover:underline disabled:pointer-events-none md:mt-1"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  {t("remove")}
                  <span className="sr-only">{name}</span>
                </button>
              </div>
              <div role="cell" className="mono col-span-2 flex items-baseline justify-between text-[0.8125rem] text-muted md:col-span-1 md:block md:text-right">
                <span className="tag-mono md:hidden">{ts("unit")}</span>
                <span>
                  {onSale ? <s className="mr-1.5 text-subtle">{formatMoney(line.compareAtPrice as number, locale, currency)}</s> : null}
                  {formatMoney(line.unitPrice, locale, currency)}
                </span>
              </div>
              <div role="cell" className="mono col-span-2 flex items-baseline justify-between text-base font-bold text-foreground md:col-span-1 md:block md:text-right">
                <span className="tag-mono font-medium text-muted md:hidden">{ts("total")}</span>
                <span>{formatMoney(line.lineTotal, locale, currency)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-foreground px-4 py-3">
        <Link href="/shop" className={buttonStyles({ variant: "outline", size: "sm" })}>
          <ArrowLeft className="size-4" aria-hidden />
          {t("continueShopping")}
        </Link>
        <p className="tag-mono text-muted">{ts("lineCount", { count: cart.lines.length, units: cart.totals.itemCount })}</p>
      </div>
    </div>
  );
}

/** Totals as a perforated order slip. */
export function OrderSlip({ cart, locale, currency, freeShippingThreshold }: { cart: CartView; locale: string; currency: CurrencyContext; freeShippingThreshold: number }) {
  const t = useTranslations("store.cart");
  const ts = useTranslations("store.cart.sheet");
  return (
    <div className="reg-marks border border-border-strong bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-dashed border-border-strong px-5 py-3.5 sm:px-6">
        <h2 id="cart-summary-heading" className="display-4">
          {ts("slip")}
        </h2>
        <span className="tag-mono text-subtle">NO. {cart.id.slice(-6).toUpperCase()}</span>
      </div>
      <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
        <FreeShippingMeter cart={cart} threshold={freeShippingThreshold} locale={locale} currency={currency} />
        <CouponBox cart={cart} currency={currency} />
        <CartTotalsList cart={cart} locale={locale} currency={currency} />
        <Link href="/checkout" className={buttonStyles({ variant: "primary", size: "lg", fullWidth: true })}>
          {t("checkout")}
          <ArrowRight className="size-5" aria-hidden />
        </Link>
        <p className="tag-mono flex items-center justify-center gap-2 text-muted">
          <Lock className="size-3.5" aria-hidden />
          {t("secure")}
        </p>
      </div>
    </div>
  );
}

/** Related parts as compact ruled rows, minus anything already in the cart. */
export function OftenTogether({ cart, related, locale, currency }: { cart: CartView; related: ProductSummary[]; locale: string; currency: CurrencyContext }) {
  const ts = useTranslations("store.cart.sheet");
  const inCart = new Set(cart.lines.map((l) => l.productId));
  const rows = related.filter((p) => !inCart.has(p.id)).slice(0, 4);
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="cart-related-heading" className="mt-10">
      <h2 id="cart-related-heading" className="display-3">
        {ts("related")}
      </h2>
      <p className="mt-1 text-sm text-muted">{ts("relatedHint")}</p>
      <ul className="mt-4 divide-y divide-border border-y-2 border-foreground">
        {rows.map((p) => {
          const name = localize(p.name, locale);
          return (
            <li key={p.id} className="group relative flex items-center gap-3 py-3 sm:gap-4">
              <ProductThumb src={p.image?.url} alt="" className="size-14 shrink-0" sizes="56px" />
              <div className="min-w-0 flex-1">
                <p className="part-no text-[0.8125rem] text-muted">{p.partNumber}</p>
                <Link href={`/product/${p.slug}`} className="line-clamp-1 text-[0.9375rem] font-semibold text-foreground after:absolute after:inset-0 hover:underline hover:underline-offset-4">
                  {name}
                </Link>
              </div>
              <p className="mono shrink-0 text-[0.9375rem] font-bold">{formatMoney(p.priceFrom, locale, currency)}</p>
              <div className="relative z-10 shrink-0">
                {p.variantCount === 1 && p.stockStatus !== "out_of_stock" ? (
                  <QuickAddButton variantId={p.defaultVariantId} productName={name} />
                ) : (
                  <Link href={`/product/${p.slug}`} className="tag-mono inline-flex min-h-11 items-center px-2 underline underline-offset-4">
                    {ts("view")}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

