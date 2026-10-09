"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { PackageOpen } from "lucide-react";
import { buttonStyles } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import type { CurrencyContext } from "@/lib/money";
import type { CartView, ProductSummary } from "@/lib/types/domain";
import { cartStore, useCartStore } from "./cart-store";
import { CartWarnings } from "./CartParts";
import { OftenTogether, OrderSlip, RequisitionTable, type LineFit } from "./CartSheet";

export function CartPageView({
  initialCart,
  locale,
  currency,
  freeShippingThreshold,
  fit,
  vehicleLabel,
  related,
}: {
  initialCart: CartView | null;
  locale: string;
  currency: CurrencyContext;
  freeShippingThreshold: number;
  fit: Record<string, LineFit>;
  vehicleLabel: string | null;
  related: ProductSummary[];
}) {
  const t = useTranslations("store.cart");
  const { cart: live } = useCartStore();

  useEffect(() => {
    cartStore.setCart(initialCart);
  }, [initialCart]);

  const cart = live ?? initialCart;
  const empty = !cart || cart.lines.length === 0;

  if (empty) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-16 text-center">
        <PackageOpen className="size-16 text-subtle" strokeWidth={1.25} aria-hidden />
        <div>
          <h2 className="display-3">{t("emptyTitle")}</h2>
          <p className="mt-2 text-muted">{t("emptyBody")}</p>
        </div>
        <Link href="/shop" className={buttonStyles({ variant: "primary", size: "lg" })}>
          {t("continueShopping")}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_21.5rem] lg:gap-10">
      <section aria-labelledby="cart-items-heading" className="min-w-0 space-y-4">
        <h2 id="cart-items-heading" className="sr-only">
          {t("itemsHeading")}
        </h2>
        <CartWarnings warnings={cart.warnings} locale={locale} currency={currency} />
        <RequisitionTable cart={cart} locale={locale} currency={currency} fit={fit} vehicleLabel={vehicleLabel} />
        <OftenTogether cart={cart} related={related} locale={locale} currency={currency} />
      </section>

      <aside aria-labelledby="cart-summary-heading" className="min-w-0 lg:sticky lg:top-32 lg:self-start">
        <OrderSlip cart={cart} locale={locale} currency={currency} freeShippingThreshold={freeShippingThreshold} />
      </aside>
    </div>
  );
}
