"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MailCheck } from "lucide-react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { requestPasswordResetAction } from "@/actions/account/auth";
import { forgotPasswordSchema } from "@/actions/account/auth.schema";
import { Alert, Button, Field, Input } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { useErrorText } from "@/lib/hooks/use-error-text";
import { applyServerFieldErrors, errorCode } from "../forms/form-utils";

type ForgotValues = z.input<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgot");
  const locale = useLocale() as Locale;
  const { validation, actionError } = useErrorText();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm<ForgotValues>({
    resolver: zodResolver(forgotPasswordSchema) as unknown as Resolver<ForgotValues>,
    defaultValues: { email: "", locale },
    mode: "onTouched",
  });
  const { register, handleSubmit, formState } = form;
  const emailError = errorCode(formState.errors, "email");

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await requestPasswordResetAction({ email: values.email, locale });
    if (result.ok) {
      setSentTo(values.email.trim());
      return;
    }
    const unmapped = applyServerFieldErrors(form, result.fieldErrors);
    if (unmapped.length > 0 || !result.fieldErrors) setFormError(actionError(result));
  });

  if (sentTo) {
    return (
      <div className="space-y-5">
        <Alert tone="success" title={t("sentTitle")}>
          {t("sentBody", { email: sentTo })}
        </Alert>
        <p className="flex items-start gap-2 text-sm text-muted">
          <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{t("sentHint")}</span>
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setSentTo(null)}>
            {t("tryAnother")}
          </Button>
          <Link href="/login" className="inline-flex h-11 items-center text-sm font-medium text-primary-text underline underline-offset-4 hover:no-underline">
            {t("back")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <Field label={t("email")} error={emailError ? validation(emailError) : undefined} required>
        <Input type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} {...register("email")} />
      </Field>
      <Button type="submit" size="lg" fullWidth loading={formState.isSubmitting}>
        {t("submit")}
      </Button>
    </form>
  );
}
