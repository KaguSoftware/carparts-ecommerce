import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { guard } from "@/components/admin/lib/guard";
import { SettingsForm } from "@/components/admin/settings/SettingsForm";
import { getSettings } from "@/lib/services/settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.settings");
  return { title: t("title") };
}

export default async function SettingsPage() {
  await guard("settings.write");
  const [t, s] = await Promise.all([getTranslations("admin.settings"), getSettings()]);
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <SettingsForm
        initial={{
          store: { name: s.store.name, legalEntity: s.store.legalEntity, email: s.store.email, phone: s.store.phone, taxId: s.store.taxId ?? "", address: { ...s.store.address } },
          currency: { tryPerUsd: s.currency.tryPerUsd },
          checkout: {
            guestCheckout: s.checkout.guestCheckout,
            orderNumberPrefix: s.checkout.orderNumberPrefix,
            maxQuantityPerLine: s.checkout.maxQuantityPerLine,
            freeShippingThreshold: s.checkout.freeShippingThreshold,
            defaultCountry: s.checkout.defaultCountry,
            shippableCountries: s.checkout.shippableCountries,
            reservationMinutes: s.checkout.reservationMinutes,
          },
          inventory: { defaultLowStockThreshold: s.inventory.defaultLowStockThreshold, allowBackorders: s.inventory.allowBackorders },
          seo: { defaultTitle: s.seo.defaultTitle, defaultDescription: s.seo.defaultDescription },
          social: { instagram: s.social.instagram ?? "", youtube: s.social.youtube ?? "", x: s.social.x ?? "", facebook: s.social.facebook ?? "" },
          maintenanceMode: s.maintenanceMode,
          emails: { ...s.emails },
        }}
      />
    </>
  );
}
