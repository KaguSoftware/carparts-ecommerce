import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { safeNextPath } from "@/actions/account/next-path";
import { AuthShell } from "@/components/account/auth/AuthShell";
import { ResendVerification } from "@/components/account/auth/ResendVerification";
import { firstParam, privatePageMetadata } from "@/components/account/seo";
import { Alert, buttonStyles } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getUserById } from "@/lib/services/accounts";

type PageProps = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Pick<PageProps, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.verify" });
  return privatePageMetadata(t("metaTitle"));
}

/**
 * One page for every stage of e-mail verification:
 *  - `?status=sent`      right after registration ("check your inbox")
 *  - `?status=verified`  Better Auth redirects here after the link was opened (`&error=` when it failed)
 *  - no params           signed-in user checking the state, or visitor following a stale link
 */
export default async function VerifyEmailPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const status = firstParam(sp.status);
  const failed = Boolean(firstParam(sp.error));
  const next = safeNextPath(firstParam(sp.next));

  const t = await getTranslations("auth.verify");
  const sessionUser = await getSessionUser();
  const account = sessionUser ? await getUserById(sessionUser.id) : null;
  const continueHref = next ?? "/account";

  if (failed) {
    return (
      <AuthShell title={t("errorTitle")}>
        <div className="space-y-5">
          <Alert tone="danger">{t("errorBody")}</Alert>
          {sessionUser ? <ResendVerification /> : (
            <Link href="/login" className={buttonStyles({ variant: "outline" })}>
              {t("signIn")}
            </Link>
          )}
        </div>
      </AuthShell>
    );
  }

  if (status === "verified" || account?.emailVerified) {
    return (
      <AuthShell title={t("verifiedTitle")} subtitle={t("verifiedBody")}>
        <Link href={sessionUser ? continueHref : "/login"} className={buttonStyles({ size: "lg", fullWidth: true })}>
          {sessionUser ? t("continue") : t("signIn")}
        </Link>
      </AuthShell>
    );
  }

  if (!sessionUser) {
    return (
      <AuthShell title={t("signedOutTitle")} subtitle={t("signedOutBody")}>
        <Link href="/login" className={buttonStyles({ size: "lg", fullWidth: true })}>
          {t("signIn")}
        </Link>
      </AuthShell>
    );
  }

  const sent = status === "sent";
  return (
    <AuthShell title={sent ? t("sentTitle") : t("pendingTitle")} subtitle={sent ? t("sentBody", { email: sessionUser.email }) : t("pendingBody", { email: sessionUser.email })}>
      <div className="space-y-6">
        <Link href={continueHref} className={buttonStyles({ size: "lg", fullWidth: true })}>
          {sent ? t("startShopping") : t("continue")}
        </Link>
        <div className="border-t border-border pt-5">
          <p className="mb-3 text-sm text-muted">{t("noEmail")}</p>
          <ResendVerification />
        </div>
      </div>
    </AuthShell>
  );
}
