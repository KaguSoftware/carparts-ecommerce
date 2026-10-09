"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Heart, ShoppingCart, Trash2 } from "lucide-react";
import { clearWishlistAction, removeWishlistItemAction } from "@/actions/account/wishlist";
import { addToCartAction } from "@/actions/store/cart";
import { ProductThumb } from "@/components/store/product/ProductThumb";
import { Badge, Button, Modal, Price, buttonStyles, useToast } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { useErrorText } from "@/lib/hooks/use-error-text";
import { localize } from "@/lib/i18n-string";
import type { CurrencyContext } from "@/lib/money";
import type { ProductSummary } from "@/lib/types/domain";

export function WishlistGrid({ products, locale, currency }: { products: ProductSummary[]; locale: string; currency: CurrencyContext }) {
  const t = useTranslations("account.wishlist");
  const router = useRouter();
  const toast = useToast();
  const { actionError } = useErrorText();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove(product: ProductSummary) {
    setBusy(`remove:${product.id}`);
    startTransition(async () => {
      const result = await removeWishlistItemAction({ productId: product.id });
      setBusy(null);
      if (!result.ok) toast.error(actionError(result));
      else {
        toast.success(t("removed", { name: localize(product.name, locale) }));
        router.refresh();
      }
    });
  }

  function addToCart(product: ProductSummary) {
    setBusy(`add:${product.id}`);
    startTransition(async () => {
      const result = await addToCartAction({ variantId: product.defaultVariantId, quantity: 1 });
      setBusy(null);
      if (!result.ok) toast.error(actionError(result));
      else {
        toast.success(t("addedToCart", { name: localize(product.name, locale) }));
        router.refresh();
      }
    });
  }

  function clearAll() {
    startTransition(async () => {
      const result = await clearWishlistAction({});
      setConfirmClear(false);
      if (!result.ok) toast.error(actionError(result));
      else router.refresh();
    });
  }

  if (products.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border-strong px-6 py-14 text-center">
        <Heart className="mx-auto size-8 text-subtle" aria-hidden />
        <p className="display-4 mt-3">{t("emptyTitle")}</p>
        <p className="mx-auto mt-2 max-w-sm text-muted">{t("emptyBody")}</p>
        <Link href="/shop" className={buttonStyles({ className: "mt-6" })}>
          {t("browse")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">
          {t("count", { count: products.length })}
        </p>
        <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)} leftIcon={<Trash2 className="size-3.5" aria-hidden />}>
          {t("clear")}
        </Button>
      </div>

      <ul className="grid gap-x-4 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => {
          const name = localize(product.name, locale);
          const soldOut = product.stockStatus === "out_of_stock";
          const needsChoice = product.variantCount > 1;
          return (
            <li key={product.id} className="flex flex-col">
              <Link href={`/product/${product.slug}`} className="group block">
                <ProductThumb src={product.image?.url} alt={product.image ? localize(product.image.alt, locale) : name} className="w-full" sizes="(min-width: 1280px) 22vw, (min-width: 640px) 40vw, 90vw" />
              </Link>
              <div className="mt-3 flex flex-1 flex-col">
                <p className="label-caps text-muted">{product.brand.name}</p>
                <h2 className="mt-1 text-base font-semibold normal-case leading-snug tracking-normal">
                  <Link href={`/product/${product.slug}`} className="font-sans underline-offset-4 hover:underline">
                    {name}
                  </Link>
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Price amount={product.priceFrom} compareAt={product.compareAtFrom} locale={locale} currency={currency} size="md" />
                  {soldOut ? <Badge tone="danger">{t("soldOut")}</Badge> : product.stockStatus === "low_stock" ? <Badge tone="warning">{t("lowStock")}</Badge> : null}
                </div>
                <div className="mt-4 flex gap-2 pt-1">
                  {needsChoice ? (
                    <Link href={`/product/${product.slug}`} className={buttonStyles({ variant: "secondary", size: "sm", className: "flex-1" })}>
                      {t("chooseOptions")}
                    </Link>
                  ) : (
                    <Button size="sm" className="flex-1" disabled={soldOut} loading={busy === `add:${product.id}`} onClick={() => addToCart(product)} leftIcon={<ShoppingCart className="size-3.5" aria-hidden />}>
                      {soldOut ? t("soldOut") : t("addToCart")}
                    </Button>
                  )}
                  <Button size="icon-sm" variant="outline" aria-label={t("removeLabel", { name })} loading={busy === `remove:${product.id}`} onClick={() => remove(product)}>
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        size="sm"
        title={t("clearTitle")}
        description={t("clearBody")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              {t("cancel")}
            </Button>
            <Button variant="danger" onClick={clearAll} loading={pending}>
              {t("clearConfirm")}
            </Button>
          </>
        }
      />
    </>
  );
}
