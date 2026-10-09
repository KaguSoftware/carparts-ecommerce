"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Heart } from "lucide-react";
import { toggleWishlistAction } from "@/actions/store/wishlist";
import { useToast } from "@/components/ui";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useErrorText } from "@/lib/hooks/use-error-text";
import { cn } from "@/lib/utils";

export interface WishlistButtonProps {
  productId: string;
  productName: string;
  initialInWishlist: boolean;
  signedIn: boolean;
  /** `overlay` sits on a product image; `inline` is a labelled button (product page). */
  variant?: "overlay" | "inline";
  className?: string;
}

export function WishlistButton({ productId, productName, initialInWishlist, signedIn, variant = "overlay", className }: WishlistButtonProps) {
  const t = useTranslations("store.card");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const { actionError } = useErrorText();
  const [inWishlist, setInWishlist] = useState(initialInWishlist);
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(`/${locale}${pathname}`)}`);
      return;
    }
    const previous = inWishlist;
    setInWishlist(!previous);
    startTransition(async () => {
      const result = await toggleWishlistAction({ productId });
      if (result.ok) {
        setInWishlist(result.data.inWishlist);
        toast.success(result.data.inWishlist ? t("wishlistAdded") : t("wishlistRemoved"));
      } else {
        setInWishlist(previous);
        toast.error(actionError(result));
      }
    });
  }

  const label = inWishlist ? t("wishlistRemove", { name: productName }) : t("wishlistAdd", { name: productName });
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={inWishlist}
      aria-label={variant === "overlay" ? label : undefined}
      disabled={pending}
      className={cn(
        "inline-flex items-center justify-center gap-2 transition-colors",
        variant === "overlay"
          ? "relative z-10 size-10 rounded-sm bg-surface/90 text-foreground shadow-sm hover:bg-surface hover:text-primary-text"
          : "h-11 rounded-sm border border-border-strong px-4 font-display text-[0.9375rem] font-semibold uppercase tracking-[0.06em] hover:border-foreground hover:bg-surface-sunken",
        className,
      )}
    >
      <Heart className={cn("size-5 transition-transform", inWishlist && "scale-110 fill-primary text-primary-text")} aria-hidden />
      {variant === "inline" ? <span>{inWishlist ? t("saved") : t("save")}</span> : null}
    </button>
  );
}
