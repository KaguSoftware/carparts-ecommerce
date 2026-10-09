import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { safeNextPath } from "@/actions/account/next-path";
import { AuthShell } from "@/components/account/auth/AuthShell";
import { LoginForm } from "@/components/account/auth/LoginForm";
import { firstParam, privatePageMetadata } from "@/components/account/seo";
import { Link, redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getSessionUser } from "@/lib/auth/session";

type PageProps = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Pick<PageProps, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.login" });
  return privatePageMetadata(t("metaTitle"));
}

export default async function LoginPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const next = safeNextPath(firstParam((await searchParams).next));

  if (await getSessionUser()) redirect({ href: next ?? "/account", locale: locale as Locale });

  const t = await getTranslations("auth.login");
  return (
    <AuthShell
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <p>
          {t("noAccount")}{" "}
          <Link href={next ? { pathname: "/register", query: { next } } : "/register"} className="font-medium text-primary-text underline underline-offset-4 hover:no-underline">
            {t("register")}
          </Link>
        </p>
      }
    >
      <LoginForm next={next} />
    </AuthShell>
  );
}
