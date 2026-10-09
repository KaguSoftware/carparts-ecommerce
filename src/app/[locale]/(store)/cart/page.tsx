import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/ui";
import { CartPageView } from "@/components/store/cart/CartPageView";
import type { LineFit } from "@/components/store/cart/CartSheet";
import { getStoreContext } from "@/components/store/shared/context";
import { pageMetadata } from "@/components/store/shared/seo";
import { Link } from "@/i18n/navigation";
import { isLocale } from "@/i18n/routing";
import { getCartView, peekCartId } from "@/lib/services/cart";
import { getRelatedProducts } from "@/lib/services/catalog";
import { checkFitment } from "@/lib/services/vehicles";
import { getPublicSettings } from "@/lib/services/settings";
import { getCartId } from "@/lib/session/cookies";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "store.cart" });
  return pageMetadata({ locale, path: "/cart", title: t("pageTitle"), noindex: true });
}

export default async function CartPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("store.cart");
  const ctx = await getStoreContext(locale);
  const [settings, cartId] = await Promise.all([getPublicSettings(), getCartId()]);
  const id = await peekCartId({ cartId, userId: ctx.user?.id ?? null });
  const cart = id ? await getCartView(id) : null;

  // Per-line fitment verdict for the saved vehicle, plus parts that are usually replaced together with what is in the cart.
  const productIds = [...new Set((cart?.lines ?? []).map((l) => l.productId))];
  const fit: Record<string, LineFit> = {};
  if (ctx.hasVehicle) {
    await Promise.all(
      productIds.map(async (pid) => {
        const result = await checkFitment(pid, ctx.vehicle).catch(() => null);
        fit[pid] = result ? (result.status === "fits" ? "fits" : result.status === "does_not_fit" ? "does_not_fit" : result.status === "universal" ? "universal" : "unknown") : "unknown";
      }),
    );
  }
  const relatedLists = await Promise.all(productIds.slice(0, 3).map((pid) => getRelatedProducts(pid, 4, ctx.hasVehicle ? ctx.vehicle : undefined)));
  const seen = new Set(productIds);
  const related = relatedLists.flat().filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true))).slice(0, 8);

  return (
    <div className="container-page py-8 md:py-12">
      <Breadcrumbs linkAs={Link} items={[{ label: t("home"), href: "/" }, { label: t("pageTitle") }]} />
      <h1 className="display-2 mb-8 mt-6 flex flex-wrap items-baseline gap-x-4">
        <span aria-hidden className="mono text-[0.32em] font-medium normal-case tracking-[0.08em] text-primary-text">
          § {t("sheetNo")}
        </span>
        {t("pageTitle")}
      </h1>
      <CartPageView initialCart={cart} locale={locale} currency={ctx.currency} freeShippingThreshold={settings.freeShippingThreshold} fit={fit} vehicleLabel={ctx.vehicleLabel} related={related} />
    </div>
  );
}
