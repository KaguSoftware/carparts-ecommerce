import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AddressBook } from "@/components/account/addresses/AddressBook";
import { countryOptions } from "@/components/account/forms/regions";
import { privatePageMetadata } from "@/components/account/seo";
import { AccountPageHeader } from "@/components/account/shell/PageHeader";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/session";
import { listAddresses } from "@/lib/services/accounts";
import { getPublicSettings } from "@/lib/services/settings";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account.addresses" });
  return privatePageMetadata(t("metaTitle"));
}

export default async function AddressesPage({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;
  const user = await requireUser(locale, "/account/addresses");
  const t = await getTranslations("account.addresses");

  const [addresses, settings] = await Promise.all([listAddresses(user.id), getPublicSettings()]);
  // Existing addresses may be in a country we no longer ship to; keep them selectable so they can still be edited.
  const countries = countryOptions([...settings.shippableCountries, ...addresses.map((a) => a.country)], locale);

  return (
    <>
      <AccountPageHeader title={t("title")} description={t("subtitle")} />
      <AddressBook addresses={addresses} countries={countries} defaultCountry={settings.defaultCountry} />
    </>
  );
}
