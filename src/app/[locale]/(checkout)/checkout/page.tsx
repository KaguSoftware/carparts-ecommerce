import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { countryOptions } from "@/components/account/forms/regions";
import { privatePageMetadata } from "@/components/account/seo";
import { CheckoutClient } from "@/components/checkout/CheckoutClient";
import { EmptyCheckout } from "@/components/checkout/EmptyCheckout";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getSessionUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import type { CheckoutQuote } from "@/lib/services/contracts";
import { getUserById, listAddresses } from "@/lib/services/accounts";
import { findCartView } from "@/lib/services/cart";
import { getCheckoutQuote } from "@/lib/services/checkout";
import { getCurrencyContext, getPublicSettings } from "@/lib/services/settings";
import { getCartId } from "@/lib/session/cookies";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });
  return privatePageMetadata(t("metaTitle"));
}

export default async function CheckoutPage({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;
  const t = await getTranslations("checkout");

  const [user, cartId, settings, currency] = await Promise.all([getSessionUser(), getCartId(), getPublicSettings(), getCurrencyContext(locale)]);

  if (settings.maintenanceMode) return <div className="container-page py-16"><EmptyCheckout variant="maintenance" /></div>;
  if (!user && !settings.guestCheckout) redirect({ href: { pathname: "/login", query: { next: "/checkout" } }, locale });

  const cart = await findCartView({ cartId, userId: user?.id ?? null });
  if (!cart || cart.lines.length === 0) {
    return (
      <div className="container-page py-16">
        <EmptyCheckout />
      </div>
    );
  }

  const [account, addresses] = await Promise.all([user ? getUserById(user.id) : null, user ? listAddresses(user.id) : []]);
  const firstAddress = addresses.find((a) => a.isDefaultShipping) ?? addresses[0];
  const countries = countryOptions([...settings.shippableCountries, ...addresses.map((a) => a.country)], locale);
  const country = firstAddress?.country ?? settings.defaultCountry;

  let initialQuote: CheckoutQuote | null = null;
  try {
    initialQuote = await getCheckoutQuote({ cartId: cart.id, destination: { country, region: firstAddress?.region ?? "" }, locale, userId: user?.id ?? null });
  } catch {
    initialQuote = null; // the client re-quotes on mount and shows the error there
  }

  return (
    <div className="container-page py-8 lg:py-12">
      <div className="mb-6 flex items-end gap-4">
        <h1 className="display-3">{t("title")}</h1>
        <span aria-hidden className="ruler mb-2 min-w-8 flex-1" />
      </div>
      <CheckoutClient
        cart={cart}
        initialQuote={initialQuote}
        currency={currency}
        countries={countries}
        defaultCountry={settings.defaultCountry}
        user={user ? { name: user.name, email: user.email, phone: account?.phone ?? "" } : null}
        savedAddresses={addresses}
        showTestCards={env.NODE_ENV !== "production" && env.PAYMENT_PROVIDER === "mock"}
      />
    </div>
  );
}
