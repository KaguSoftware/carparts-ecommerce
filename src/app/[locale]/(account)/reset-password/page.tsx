import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/components/account/auth/AuthShell";
import { ResetPasswordForm } from "@/components/account/auth/ResetPasswordForm";
import { firstParam, privatePageMetadata } from "@/components/account/seo";
import { Alert } from "@/components/ui";
import { Link } from "@/i18n/navigation";

type PageProps = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Pick<PageProps, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.reset" });
  return privatePageMetadata(t("metaTitle"));
}

/**
 * Landing page of the e-mailed reset link. Better Auth validates the token first and redirects here with
 * `?token=...` (valid) or `?error=INVALID_TOKEN` (expired / used).
 */
export default async function ResetPasswordPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const token = firstParam(sp.token)?.trim();
  const failed = Boolean(firstParam(sp.error)) || !token;
  const t = await getTranslations("auth.reset");

  return (
    <AuthShell title={t("title")} subtitle={failed ? undefined : t("subtitle")}>
      {failed || !token ? (
        <div className="space-y-5">
          <Alert tone="danger" title={t("invalidTitle")}>
            {t("invalidBody")}
          </Alert>
          <Link href="/forgot-password" className="inline-flex h-11 items-center text-sm font-medium text-primary-text underline underline-offset-4 hover:no-underline">
            {t("requestNew")}
          </Link>
        </div>
      ) : (
        <ResetPasswordForm token={token} />
      )}
    </AuthShell>
  );
}
