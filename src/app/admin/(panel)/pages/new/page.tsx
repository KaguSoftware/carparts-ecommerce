import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageForm } from "@/components/admin/content/PageForm";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { guard } from "@/components/admin/lib/guard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.pages");
  return { title: t("new") };
}

export default async function NewPagePage() {
  await guard("cms.write");
  const t = await getTranslations("admin.pages");
  return (
    <>
      <PageHeader title={t("new")} back={{ href: "/admin/pages", label: t("title") }} />
      <PageForm />
    </>
  );
}
