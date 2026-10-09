import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { privatePageMetadata } from "@/components/account/seo";
import { AccountPageHeader } from "@/components/account/shell/PageHeader";
import { DeleteAccount } from "@/components/account/profile/DeleteAccount";
import { ProfileForm } from "@/components/account/profile/ProfileForm";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/session";
import { getUserById } from "@/lib/services/accounts";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account.profile" });
  return privatePageMetadata(t("metaTitle"));
}

export default async function ProfilePage({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;
  const sessionUser = await requireUser(locale, "/account/profile");
  const t = await getTranslations("account.profile");
  const user = await getUserById(sessionUser.id);
  if (!user) notFound();

  return (
    <>
      <AccountPageHeader title={t("title")} description={t("subtitle")} />
      <div className="space-y-12">
        <ProfileForm
          initial={{ name: user.name, phone: user.phone ?? "", locale: user.locale, marketingOptIn: user.marketingOptIn }}
          email={user.email}
          emailVerified={user.emailVerified}
        />
        {user.role === "customer" ? <DeleteAccount email={user.email} /> : null}
      </div>
    </>
  );
}
