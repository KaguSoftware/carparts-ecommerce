"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { signUpAction } from "@/actions/account/auth";
import { signUpFormSchema } from "@/actions/account/auth.schema";
import { Alert, Button, Checkbox, Field, Input } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { useErrorText } from "@/lib/hooks/use-error-text";
import { applyServerFieldErrors, errorCode } from "../forms/form-utils";
import { PasswordInput } from "./PasswordInput";
import { PasswordRules } from "./PasswordRules";

type RegisterValues = z.input<typeof signUpFormSchema>;

export function RegisterForm({ next }: { next: string | null }) {
  const t = useTranslations("auth.register");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { validation, actionError } = useErrorText();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(signUpFormSchema) as unknown as Resolver<RegisterValues>,
    defaultValues: { name: "", email: "", password: "", confirmPassword: "", marketingOptIn: false, acceptTerms: false, next, locale },
    mode: "onTouched",
  });
  const { register, handleSubmit, formState, control } = form;
  const password = useWatch({ control, name: "password" }) ?? "";
  const err = (name: string) => {
    const code = errorCode(formState.errors, name);
    return code ? validation(code) : undefined;
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await signUpAction({ name: values.name, email: values.email, password: values.password, marketingOptIn: values.marketingOptIn, next, locale });
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
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <Field label={t("name")} error={err("name")} required>
        <Input autoComplete="name" {...register("name")} />
      </Field>

      <Field label={t("email")} error={err("email")} required>
        <Input type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} {...register("email")} />
      </Field>

      <div className="space-y-2">
        <Field label={t("password")} error={err("password")} required>
          <PasswordInput autoComplete="new-password" {...register("password")} />
        </Field>
        <PasswordRules value={password} />
      </div>

      <Field label={t("confirmPassword")} error={err("confirmPassword")} required>
        <PasswordInput autoComplete="new-password" {...register("confirmPassword")} />
      </Field>

      <div className="space-y-3">
        <Checkbox label={t("marketing")} {...register("marketingOptIn")} />
        <div>
          <Checkbox
            invalid={Boolean(err("acceptTerms"))}
            label={t.rich("terms", {
              terms: (chunks) => (
                <Link href="/pages/terms" target="_blank" rel="noopener" className="font-medium text-primary-text underline underline-offset-4 hover:no-underline">
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link href="/pages/privacy" target="_blank" rel="noopener" className="font-medium text-primary-text underline underline-offset-4 hover:no-underline">
                  {chunks}
                </Link>
              ),
            })}
            {...register("acceptTerms")}
          />
          {err("acceptTerms") ? (
            <p role="alert" className="mt-1.5 text-[0.8125rem] font-medium text-danger">
              {err("acceptTerms")}
            </p>
          ) : null}
        </div>
      </div>

      <Button type="submit" size="lg" fullWidth loading={busy}>
        {busy ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
