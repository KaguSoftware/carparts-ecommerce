"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Plus, ShoppingCart } from "lucide-react";
import { addToCartAction } from "@/actions/store/cart";
import { Button, buttonStyles, useToast } from "@/components/ui";
import { useErrorText } from "@/lib/hooks/use-error-text";
import { cn } from "@/lib/utils";
import { cartStore } from "../cart/cart-store";

/** Shared add-to-cart behaviour: server action, store update, drawer opens, errors become toasts. */
export function useAddToCart() {
  const toast = useToast();
  const { actionError } = useErrorText();
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);

  function add(variantId: string, quantity: number, opts: { openDrawer?: boolean } = {}) {
    startTransition(async () => {
      const result = await addToCartAction({ variantId, quantity });
      if (result.ok) {
        cartStore.setCart(result.data);
        cartStore.flashAdded(variantId);
        if (opts.openDrawer !== false) cartStore.openDrawer();
        setAdded(true);
        window.setTimeout(() => setAdded(false), 1800);
      } else {
        toast.error(actionError(result));
      }
    });
  }
  return { add, pending, added };
}

/** Compact "+" button for product cards (single-variant products). */
export function QuickAddButton({ variantId, productName, className }: { variantId: string; productName: string; className?: string }) {
  const t = useTranslations("store.card");
  const { add, pending, added } = useAddToCart();
  return (
    <button
      type="button"
      onClick={() => add(variantId, 1)}
      disabled={pending}
      aria-label={t("addToCartNamed", { name: productName })}
      className={cn(
        buttonStyles({ variant: added ? "secondary" : "primary", size: "icon" }),
        "relative z-10 shrink-0",
        className,
      )}
    >
      {added ? <Check className="size-5" aria-hidden /> : pending ? <ShoppingCart className="size-5 animate-pulse" aria-hidden /> : <Plus className="size-5" strokeWidth={2.5} aria-hidden />}
    </button>
  );
}

/** Full-size button used on the product page. */
export function AddToCartButton({ variantId, quantity, disabled, label }: { variantId: string; quantity: number; disabled?: boolean; label?: string }) {
  const t = useTranslations("store.product");
  const { add, pending, added } = useAddToCart();
  return (
    <Button
      size="lg"
      fullWidth
      loading={pending}
      disabled={disabled}
      onClick={() => add(variantId, quantity)}
      leftIcon={added ? <Check className="size-5" aria-hidden /> : <ShoppingCart className="size-5" aria-hidden />}
    >
      {added ? t("addedToCart") : (label ?? t("addToCart"))}
    </Button>
  );
}
