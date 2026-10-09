"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInAction } from "@/actions/account/auth";
import { signInSchema, type SignInInput } from "@/actions/account/auth.schema";
import { Alert, Button, Field, Input } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { useErrorText } from "@/lib/hooks/use-error-text";
import { applyServerFieldErrors, errorCode } from "../forms/form-utils";
import { PasswordInput } from "./PasswordInput";

export function LoginForm({ next }: { next: string | null }) {
  const t = useTranslations("auth.login");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { validation, actionError } = useErrorText();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema) as unknown as Resolver<SignInInput>,
    defaultValues: { email: "", password: "", next, locale },
    mode: "onTouched",
  });
  const { register, handleSubmit, formState } = form;
  const err = (name: string) => {
    const code = errorCode(formState.errors, name);
    return code ? validation(code) : undefined;
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await signInAction({ ...values, next, locale });
    if (result.ok) {
      setDone(true);
      router.replace(result.data.redirectTo);
      router.refresh();
      return;
    }
    const unmapped = applyServerFieldErrors(form, result.fieldErrors);
    if (unmapped.length > 0 || !result.fieldErrors) setFormError(actionError(result));
  });

  const busy = formState.isSubmitting || done;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {next ? <Alert tone="info">{t("nextNotice")}</Alert> : null}
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <Field label={t("email")} error={err("email")} required>
        <Input type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} {...register("email")} />
      </Field>

      <div className="space-y-1.5">
        <Field label={t("password")} error={err("password")} required>
          <PasswordInput autoComplete="current-password" {...register("password")} />
        </Field>
        <div className="text-right">
          <Link href="/forgot-password" className="text-sm font-medium text-primary-text underline-offset-4 hover:underline">
            {t("forgot")}
          </Link>
        </div>
      </div>

      <Button type="submit" size="lg" fullWidth loading={busy}>
        {busy ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
