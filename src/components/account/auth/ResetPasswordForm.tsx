"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CircleCheck } from "lucide-react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { resetPasswordAction } from "@/actions/account/auth";
import { resetPasswordFormSchema } from "@/actions/account/auth.schema";
import { Alert, Button, Field } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { useErrorText } from "@/lib/hooks/use-error-text";
import { applyServerFieldErrors, errorCode } from "../forms/form-utils";
import { PasswordInput } from "./PasswordInput";
import { PasswordRules } from "./PasswordRules";

type ResetValues = z.input<typeof resetPasswordFormSchema>;

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth.reset");
  const { validation, actionError } = useErrorText();
  const [formError, setFormError] = useState<string | null>(null);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [success, setSuccess] = useState(false);

  const form = useForm<ResetValues>({
    resolver: zodResolver(resetPasswordFormSchema) as unknown as Resolver<ResetValues>,
    defaultValues: { newPassword: "", confirmPassword: "" },
    mode: "onTouched",
  });
  const { register, handleSubmit, formState, control } = form;
  const password = useWatch({ control, name: "newPassword" }) ?? "";
  const err = (name: string) => {
    const code = errorCode(formState.errors, name);
    return code ? validation(code) : undefined;
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await resetPasswordAction({ token, newPassword: values.newPassword });
    if (result.ok) {
      setSuccess(true);
      return;
    }
    if (result.error === "invalid_token") {
      setTokenInvalid(true);
      return;
    }
    const unmapped = applyServerFieldErrors(form, result.fieldErrors);
    if (unmapped.length > 0 || !result.fieldErrors) setFormError(actionError(result));
  });

  if (success) {
    return (
      <div className="space-y-5">
        <Alert tone="success" title={t("successTitle")}>
          {t("successBody")}
        </Alert>
        <Link href="/login" className="inline-flex h-11 items-center gap-2 text-sm font-medium text-primary-text underline underline-offset-4 hover:no-underline">
          <CircleCheck className="size-4" aria-hidden />
          {t("signIn")}
        </Link>
      </div>
    );
  }

  if (tokenInvalid) {
    return (
      <div className="space-y-5">
        <Alert tone="danger" title={t("invalidTitle")}>
          {t("invalidBody")}
        </Alert>
        <Link href="/forgot-password" className="inline-flex h-11 items-center text-sm font-medium text-primary-text underline underline-offset-4 hover:no-underline">
          {t("requestNew")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <div className="space-y-2">
        <Field label={t("newPassword")} error={err("newPassword")} required>
          <PasswordInput autoComplete="new-password" {...register("newPassword")} />
        </Field>
        <PasswordRules value={password} />
      </div>
      <Field label={t("confirmPassword")} error={err("confirmPassword")} required>
        <PasswordInput autoComplete="new-password" {...register("confirmPassword")} />
      </Field>
      <Button type="submit" size="lg" fullWidth loading={formState.isSubmitting}>
        {t("submit")}
      </Button>
    </form>
  );
}
