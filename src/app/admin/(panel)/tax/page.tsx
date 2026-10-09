import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { guard } from "@/components/admin/lib/guard";
import { TaxManager, type TaxRow } from "@/components/admin/settings/TaxManager";
import { Alert } from "@/components/ui/Alert";
import { listTaxRates } from "@/lib/services/tax";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.tax");
  return { title: t("title") };
}

export default async function TaxPage() {
  await guard("settings.write");
  const [t, rates] = await Promise.all([getTranslations("admin.tax"), listTaxRates()]);
  const rows: TaxRow[] = rates.map((r) => ({ id: r.id, name: r.name, country: r.country, region: r.region, rateBps: r.rateBps, appliesToShipping: r.appliesToShipping, isActive: r.isActive }));
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <Alert tone="info" className="mb-4">
        {t("note")}
      </Alert>
      <TaxManager rows={rows} />
    </>
  );
}
