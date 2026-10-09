"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { cartStore, useCartStore } from "./cart-store";

/**
 * Header cart button. `initialCount` comes from the server render; once the visitor changes the cart
 * the shared client store takes over so the badge updates instantly.
 */
export function CartButton({ initialCount, className }: { initialCount: number; className?: string }) {
  const t = useTranslations("store.cart");
  const { cart } = useCartStore();

  useEffect(() => {
    cartStore.syncServerCount(initialCount);
  }, [initialCount]);

  const count = cart ? cart.totals.itemCount : initialCount;
  return (
    <button
      type="button"
      onClick={() => cartStore.openDrawer()}
      aria-haspopup="dialog"
      aria-label={t("open", { count })}
      className={cn("relative inline-flex h-12 min-w-11 flex-col items-center justify-center gap-0.5 px-1.5 text-current transition-colors hover:bg-current/10", className)}
    >
      <ShoppingCart className="size-6" aria-hidden />
      <span aria-hidden className="tag-mono hidden text-[0.5625rem] leading-none lg:block">
        {t("shortLabel")}
      </span>
      <span
        aria-hidden
        className={cn(
          "num absolute right-0 top-0 flex min-w-5 items-center justify-center rounded-xs bg-primary px-1 py-0.5 text-[0.6875rem] font-bold leading-none text-primary-foreground transition-transform duration-200",
          count > 0 ? "scale-100" : "scale-0",
        )}
      >
        {count > 99 ? "99+" : count}
      </span>
    </button>
  );
}
