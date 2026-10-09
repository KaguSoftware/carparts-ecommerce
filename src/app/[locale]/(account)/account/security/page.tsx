import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PasswordForm } from "@/components/account/profile/PasswordForm";
import { privatePageMetadata } from "@/components/account/seo";
import { AccountPageHeader } from "@/components/account/shell/PageHeader";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/session";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account.security" });
  return privatePageMetadata(t("metaTitle"));
}

export default async function SecurityPage({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  setRequestLocale(rawLocale);
  await requireUser(rawLocale as Locale, "/account/security");
  const t = await getTranslations("account.security");

  return (
    <>
      <AccountPageHeader title={t("title")} description={t("subtitle")} />
      <section aria-labelledby="change-password">
        <h2 id="change-password" className="display-4 mb-5">
          {t("passwordHeading")}
        </h2>
        <PasswordForm />
      </section>
    </>
  );
}
