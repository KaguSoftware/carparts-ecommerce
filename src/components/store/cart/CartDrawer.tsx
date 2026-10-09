"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, PackageOpen } from "lucide-react";
import { buttonStyles, Modal, Skeleton } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { formatMoney, type CurrencyContext } from "@/lib/money";
import { cartStore, useCartStore } from "./cart-store";
import { CartLines, CartTotalsList, CartWarnings, FreeShippingMeter } from "./CartParts";

/** Slide-over mini cart. Mounted once by SiteHeader; opened by CartButton and by every add-to-cart. */
export function CartDrawer({ locale, currency, freeShippingThreshold }: { locale: string; currency: CurrencyContext; freeShippingThreshold: number }) {
  const t = useTranslations("store.cart");
  const { cart, open, loading } = useCartStore();

  useEffect(() => {
    if (open) void cartStore.refresh();
  }, [open]);

  const empty = !cart || cart.lines.length === 0;
  const close = () => cartStore.closeDrawer();

  return (
    <Modal
      open={open}
      onClose={close}
      placement="right"
      title={t("title")}
      description={cart && !empty ? t("itemCount", { count: cart.totals.itemCount }) : undefined}
      footer={
        cart && !empty ? (
          <div className="w-full space-y-4">
            <FreeShippingMeter cart={cart} threshold={freeShippingThreshold} locale={locale} currency={currency} />
            <CartTotalsList cart={cart} locale={locale} currency={currency} />
            <div className="grid gap-2.5">
              <Link href="/checkout" onClick={close} className={buttonStyles({ variant: "primary", size: "lg", fullWidth: true })}>
                {t("checkout")}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link href="/cart" onClick={close} className={buttonStyles({ variant: "outline", fullWidth: true })}>
                {t("viewCart")}
              </Link>
            </div>
          </div>
        ) : undefined
      }
    >
      {empty && loading ? (
        <div className="space-y-5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="size-20 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-9 w-28" />
              </div>
            </div>
          ))}
        </div>
      ) : empty ? (
        <div className="flex h-full min-h-64 flex-col items-center justify-center gap-4 text-center">
          <PackageOpen className="size-12 text-subtle" strokeWidth={1.5} aria-hidden />
          <div>
            <p className="display-4">{t("emptyTitle")}</p>
            <p className="mt-1 text-sm text-muted">{t("emptyBody")}</p>
          </div>
          <Link href="/shop" onClick={close} className={buttonStyles({ variant: "primary" })}>
            {t("continueShopping")}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <CartWarnings warnings={cart.warnings} locale={locale} currency={currency} />
          <CartLines cart={cart} locale={locale} currency={currency} compact />
          <p className="sr-only" aria-live="polite">
            {t("subtotalAnnounce", { amount: formatMoney(cart.totals.subtotal, locale, currency) })}
          </p>
        </div>
      )}
    </Modal>
  );
}
