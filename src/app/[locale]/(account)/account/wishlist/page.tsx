import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { privatePageMetadata } from "@/components/account/seo";
import { AccountPageHeader } from "@/components/account/shell/PageHeader";
import { WishlistGrid } from "@/components/account/wishlist/WishlistGrid";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/session";
import { getCurrencyContext } from "@/lib/services/settings";
import { getWishlistProducts } from "@/lib/services/wishlist";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account.wishlist" });
  return privatePageMetadata(t("metaTitle"));
}

export default async function WishlistPage({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;
  const user = await requireUser(locale, "/account/wishlist");
  const t = await getTranslations("account.wishlist");
  const [products, currency] = await Promise.all([getWishlistProducts(user.id), getCurrencyContext(locale)]);

  return (
    <>
      <AccountPageHeader title={t("title")} description={t("subtitle")} />
      <WishlistGrid products={products} locale={locale} currency={currency} />
    </>
  );
}
