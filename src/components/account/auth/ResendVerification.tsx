"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { resendVerificationAction } from "@/actions/account/auth";
import { Alert, Button } from "@/components/ui";
import type { Locale } from "@/i18n/routing";
import { useErrorText } from "@/lib/hooks/use-error-text";

/** "Send the link again" for signed-in users whose address is not verified yet. */
export function ResendVerification() {
  const t = useTranslations("auth.verify");
  const locale = useLocale() as Locale;
  const { actionError } = useErrorText();
  const [state, setState] = useState<{ kind: "idle" | "sending" | "sent" } | { kind: "error"; message: string }>({ kind: "idle" });

  async function resend() {
    setState({ kind: "sending" });
    const result = await resendVerificationAction({ locale });
    setState(result.ok ? { kind: "sent" } : { kind: "error", message: actionError(result) });
  }

  return (
    <div className="space-y-3">
      <Button variant="outline" onClick={resend} loading={state.kind === "sending"} disabled={state.kind === "sent"}>
        {t("resend")}
      </Button>
      <div aria-live="polite">
        {state.kind === "sent" ? <Alert tone="success">{t("resendSent")}</Alert> : null}
        {state.kind === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
      </div>
    </div>
  );
}
