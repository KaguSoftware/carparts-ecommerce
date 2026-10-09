import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { guard } from "@/components/admin/lib/guard";
import { ShippingManager, type ShippingRow } from "@/components/admin/settings/ShippingManager";
import { listShippingMethods } from "@/lib/services/shipping";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.shipping");
  return { title: t("title") };
}

export default async function ShippingPage() {
  await guard("settings.write");
  const [t, methods] = await Promise.all([getTranslations("admin.shipping"), listShippingMethods()]);
  const rows: ShippingRow[] = methods.map((m) => ({
    id: m.id,
    code: m.code,
    name: m.name,
    description: m.description,
    countries: m.countries,
    price: m.price,
    perKgPrice: m.perKgPrice,
    freeOverSubtotal: m.freeOverSubtotal,
    estimatedDaysMin: m.estimatedDaysMin,
    estimatedDaysMax: m.estimatedDaysMax,
    isActive: m.isActive,
    sortOrder: m.sortOrder,
  }));
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <ShippingManager rows={rows} />
    </>
  );
}
