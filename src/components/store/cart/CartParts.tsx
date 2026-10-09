"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Minus, Plus, Tag, Trash2, Truck, X } from "lucide-react";
import { applyCouponAction, removeCouponAction, removeFromCartAction, setCartQuantityAction } from "@/actions/store/cart";
import { PartPlate } from "@/components/shared/PartPlate";
import { Alert, Button, Input, useToast } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/action-result";
import { useErrorText } from "@/lib/hooks/use-error-text";
import { formatMoney, type CurrencyContext } from "@/lib/money";
import { localize } from "@/lib/i18n-string";
import type { CartLine, CartView, CartWarning } from "@/lib/types/domain";
import { cn } from "@/lib/utils";
import { ProductThumb } from "../product/ProductThumb";
import { cartStore, useCartStore } from "./cart-store";

export interface CartCommonProps {
  locale: string;
  currency: CurrencyContext;
}

/** Cart mutations with pending state + error toasts. Each success pushes the fresh cart into the shared store. */
export function useCartMutations(currency?: CurrencyContext) {
  const toast = useToast();
  const { actionError } = useErrorText();
  const [pending, setPending] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<ActionResult<CartView>>): Promise<ActionResult<CartView>> {
    setPending(key);
    try {
      const result = await fn();
      if (result.ok) cartStore.setCart(result.data);
      else toast.error(actionError(result, currency));
      return result;
    } finally {
      setPending(null);
    }
  }

  return {
    pending,
    setQuantity: (variantId: string, quantity: number) => run(variantId, () => setCartQuantityAction({ variantId, quantity })),
    remove: (variantId: string) => run(variantId, () => removeFromCartAction({ variantId })),
    removeCoupon: () => run("coupon", () => removeCouponAction()),
    applyCoupon: async (code: string) => {
      setPending("coupon");
      try {
        const result = await applyCouponAction({ code });
        if (result.ok) cartStore.setCart(result.data);
        return result;
      } finally {
        setPending(null);
      }
    },
  };
}

/* ---------------------------------------------------------------- lines */

export function QuantityStepper({ line, name, busy, onChange, compact }: { line: CartLine; name: string; busy: boolean; onChange: (q: number) => void; compact?: boolean }) {
  const t = useTranslations("store.cart");
  const max = Math.max(1, line.maxQuantity);
  const btn = cn(
    "inline-flex items-center justify-center text-foreground transition-colors hover:bg-surface-sunken disabled:pointer-events-none disabled:opacity-40",
    compact ? "size-9" : "size-10",
  );
  return (
    <div className="inline-flex items-center border border-border-strong bg-surface" role="group" aria-label={t("quantityFor", { name })}>
      <button type="button" className={btn} disabled={busy || line.quantity <= 1} onClick={() => onChange(line.quantity - 1)} aria-label={t("decrease")}>
        <Minus className="size-4" aria-hidden />
      </button>
      <span className="mono min-w-8 text-center text-[0.9375rem] font-semibold" aria-live="polite" aria-atomic="true">
        {line.quantity}
      </span>
      <button type="button" className={btn} disabled={busy || line.quantity >= max} onClick={() => onChange(line.quantity + 1)} aria-label={t("increase")}>
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export function CartLines({ cart, locale, currency, compact }: CartCommonProps & { cart: CartView; compact?: boolean }) {
  const t = useTranslations("store.cart");
  const { pending, setQuantity, remove } = useCartMutations(currency);
  const { justAdded } = useCartStore();

  return (
    <ul className="divide-y divide-border">
      {cart.lines.map((line) => {
        const busy = pending === line.variantId;
        const name = localize(line.name, locale);
        const variant = localize(line.variantName, locale);
        const onSale = line.compareAtPrice !== undefined && line.compareAtPrice > line.unitPrice;
        return (
          <li key={line.variantId} className={cn("flex gap-4", compact ? "py-4" : "py-5", busy && "opacity-60")} aria-busy={busy}>
            <Link href={`/product/${line.slug}`} className="shrink-0" tabIndex={-1} aria-hidden>
              <ProductThumb src={line.image} alt="" className={compact ? "size-20" : "size-24 sm:size-28"} sizes="112px" />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/product/${line.slug}`} className="line-clamp-2 text-[0.9375rem] font-semibold leading-snug text-foreground underline-offset-4 hover:underline">
                    {name}
                  </Link>
                  <p className="mt-0.5 text-[0.8125rem] text-muted">
                    {line.brandName} · {variant}
                  </p>
                  <PartPlate size="sm" partNumber={line.partNumber} sku={line.sku} stamp={justAdded === line.variantId} className="mt-1" />
                </div>
                <p className="num shrink-0 text-right font-display text-lg font-bold leading-none text-foreground">{formatMoney(line.lineTotal, locale, currency)}</p>
              </div>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <QuantityStepper line={line} name={name} busy={busy} compact={compact} onChange={(q) => void setQuantity(line.variantId, q)} />
                <div className="flex items-center gap-3 text-sm">
                  {line.quantity > 1 || onSale ? (
                    <span className="num text-muted">
                      {onSale ? <s className="mr-1.5">{formatMoney(line.compareAtPrice as number, locale, currency)}</s> : null}
                      {t("each", { price: formatMoney(line.unitPrice, locale, currency) })}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void remove(line.variantId)}
                    disabled={busy}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-sm px-1.5 text-muted underline-offset-4 transition-colors hover:text-danger hover:underline disabled:pointer-events-none"
                  >
                    <Trash2 className="size-4" aria-hidden />
                    <span>{t("remove")}</span>
                    <span className="sr-only">{name}</span>
                  </button>
                </div>
              </div>
              {line.maxQuantity <= 3 && line.maxQuantity > 0 ? <p className="text-[0.8125rem] font-medium text-warning">{t("onlyLeft", { count: line.maxQuantity })}</p> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------------------------------------------------------- warnings */

export function CartWarnings({ warnings, locale, currency }: CartCommonProps & { warnings: CartWarning[] }) {
  const t = useTranslations("store.cart.warnings");
  if (!warnings.length) return null;
  return (
    <div className="space-y-2">
      {warnings.map((w, i) => {
        let text: string;
        switch (w.type) {
          case "price_changed":
            text = t("priceChanged", { from: formatMoney(w.from, locale, currency), to: formatMoney(w.to, locale, currency) });
            break;
          case "quantity_reduced":
            text = t("quantityReduced", { requested: w.requested, available: w.available });
            break;
          case "item_removed":
            text = w.reason === "out_of_stock" ? t("removedOutOfStock") : t("removedUnavailable");
            break;
          case "coupon_removed":
            text = t("couponRemoved", { code: w.code });
            break;
        }
        return (
          <Alert key={`${w.type}-${i}`} tone="warning">
            {text}
          </Alert>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- free shipping meter */

export function FreeShippingMeter({ cart, threshold, locale, currency }: CartCommonProps & { cart: CartView; threshold: number }) {
  const t = useTranslations("store.cart");
  if (threshold <= 0 || cart.lines.length === 0) return null;
  const remaining = cart.totals.freeShippingRemaining;
  const progress = remaining <= 0 ? 100 : Math.max(4, Math.min(100, Math.round(((threshold - remaining) / threshold) * 100)));
  return (
    <div>
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Truck className="size-4 text-primary-text" aria-hidden />
        {remaining <= 0 ? t("freeShippingReached") : t("freeShippingRemaining", { amount: formatMoney(remaining, locale, currency) })}
      </p>
      <div className="relative mt-2.5 h-3 border border-border-strong bg-surface-sunken" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={t("freeShippingProgress")}>
        <div className="h-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} />
        <div aria-hidden className="pointer-events-none absolute inset-0 [background-image:repeating-linear-gradient(to_right,var(--border-strong)_0_1px,transparent_1px_10%)]" />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- coupon */

export function CouponBox({ cart, currency, className }: { cart: CartView; currency: CurrencyContext; className?: string }) {
  const t = useTranslations("store.cart");
  const { actionError } = useErrorText();
  const { applyCoupon, removeCoupon, pending } = useCartMutations(currency);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const busy = pending === "coupon";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setError(null);
    const result = await applyCoupon(code);
    if (result.ok) setCode("");
    else setError(actionError(result, currency));
  }

  if (cart.coupon) {
    return (
      <div className={cn("flex items-center justify-between gap-3 rounded-sm bg-success-soft px-3.5 py-2.5 text-sm text-success", className)}>
        <p className="flex min-w-0 items-center gap-2 font-medium">
          <Tag className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{t("couponApplied", { code: cart.coupon.code })}</span>
        </p>
        <button
          type="button"
          onClick={() => void removeCoupon()}
          disabled={busy}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm hover:bg-success/10"
          aria-label={t("couponRemove", { code: cart.coupon.code })}
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={className} noValidate>
      <label htmlFor="cart-coupon" className="text-sm font-medium text-foreground">
        {t("couponLabel")}
      </label>
      <div className="mt-1.5 flex gap-2">
        <Input
          id="cart-coupon"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t("couponPlaceholder")}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          invalid={!!error}
          aria-describedby={error ? "cart-coupon-error" : undefined}
          className="uppercase"
        />
        <Button type="submit" variant="secondary" loading={busy} disabled={!code.trim()}>
          {t("couponApply")}
        </Button>
      </div>
      {error ? (
        <p id="cart-coupon-error" role="alert" className="mt-1.5 text-[0.8125rem] font-medium text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}

/* ---------------------------------------------------------------- totals */

export function CartTotalsList({ cart, locale, currency }: CartCommonProps & { cart: CartView }) {
  const t = useTranslations("store.cart");
  const { totals } = cart;
  const row = "flex items-baseline justify-between gap-4";
  return (
    <dl className="space-y-2.5 text-[0.9375rem]">
      <div className={row}>
        <dt className="text-muted">{t("subtotal")}</dt>
        <dd className="mono font-medium">{formatMoney(totals.subtotal, locale, currency)}</dd>
      </div>
      {totals.discount > 0 ? (
        <div className={row}>
          <dt className="text-success">{cart.coupon ? t("discountWithCode", { code: cart.coupon.code }) : t("discount")}</dt>
          <dd className="mono font-medium text-success">-{formatMoney(totals.discount, locale, currency)}</dd>
        </div>
      ) : null}
      <div className={row}>
        <dt className="text-muted">{t("shipping")}</dt>
        <dd className="text-muted">{cart.coupon?.freeShipping ? t("freeShipping") : t("calculatedAtCheckout")}</dd>
      </div>
      <div className={cn(row, "border-t-2 border-foreground pt-3")}>
        <dt className="font-display text-lg font-bold uppercase tracking-wide">{t("estimatedTotal")}</dt>
        <dd className="mono text-2xl font-bold leading-none">{formatMoney(totals.subtotal - totals.discount, locale, currency)}</dd>
      </div>
    </dl>
  );
}
