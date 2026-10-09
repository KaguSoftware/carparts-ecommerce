"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ShoppingCart } from "lucide-react";
import { buttonStyles } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { clearCheckoutKey } from "./form/checkout-key";

/** Shown when /checkout is opened with nothing to pay for. Also forgets any stale idempotency key. */
export function EmptyCheckout({ variant = "empty" }: { variant?: "empty" | "maintenance" }) {
  const t = useTranslations("checkout.empty");
  useEffect(() => clearCheckoutKey(), []);

  return (
    <div className="mx-auto max-w-lg rounded-md border border-dashed border-border-strong px-6 py-16 text-center">
      <ShoppingCart className="mx-auto size-9 text-subtle" aria-hidden />
      <h1 className="display-3 mt-4">{variant === "maintenance" ? t("maintenanceTitle") : t("title")}</h1>
      <p className="mx-auto mt-2 max-w-sm text-muted">{variant === "maintenance" ? t("maintenanceBody") : t("body")}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/shop" className={buttonStyles()}>
          {t("continueShopping")}
        </Link>
        <Link href="/cart" className={buttonStyles({ variant: "outline" })}>
          {t("viewCart")}
        </Link>
      </div>
    </div>
  );
}
