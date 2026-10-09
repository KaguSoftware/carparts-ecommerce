"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { changePasswordAction } from "@/actions/account/auth";
import { changePasswordFormSchema } from "@/actions/account/auth.schema";
import { Alert, Button, Field, useToast } from "@/components/ui";
import { useErrorText } from "@/lib/hooks/use-error-text";
import { PasswordInput } from "../auth/PasswordInput";
import { PasswordRules } from "../auth/PasswordRules";
import { applyServerFieldErrors, errorCode } from "../forms/form-utils";

type PasswordValues = z.input<typeof changePasswordFormSchema>;

export function PasswordForm() {
  const t = useTranslations("account.security");
  const toast = useToast();
  const { validation, actionError } = useErrorText();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<PasswordValues>({
    resolver: zodResolver(changePasswordFormSchema) as unknown as Resolver<PasswordValues>,
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    mode: "onTouched",
  });
  const { register, handleSubmit, formState, control, reset } = form;
  const next = useWatch({ control, name: "newPassword" }) ?? "";
  const err = (name: string) => {
    const code = errorCode(formState.errors, name);
    return code ? validation(code) : undefined;
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await changePasswordAction({ currentPassword: values.currentPassword, newPassword: values.newPassword });
    if (result.ok) {
      toast.success(t("changed"));
      reset();
      return;
    }
    const unmapped = applyServerFieldErrors(form, result.fieldErrors);
    if (unmapped.length > 0 || !result.fieldErrors) setFormError(actionError(result));
    if (result.error === "password_incorrect") form.setFocus("currentPassword");
  });

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-xl space-y-5">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <Field label={t("currentPassword")} error={err("currentPassword")} required>
        <PasswordInput autoComplete="current-password" {...register("currentPassword")} />
      </Field>

      <div className="space-y-2">
        <Field label={t("newPassword")} error={err("newPassword")} required>
          <PasswordInput autoComplete="new-password" {...register("newPassword")} />
        </Field>
        <PasswordRules value={next} />
      </div>

      <Field label={t("confirmPassword")} error={err("confirmPassword")} required>
        <PasswordInput autoComplete="new-password" {...register("confirmPassword")} />
      </Field>

      <p className="text-sm text-muted">{t("otherSessionsNote")}</p>

      <Button type="submit" loading={formState.isSubmitting}>
        {t("submit")}
      </Button>
    </form>
  );
}
