"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateProfileAction } from "@/actions/account/profile";
import { updateProfileSchema, type UpdateProfileInput } from "@/actions/account/profile.schema";
import { Alert, Button, Checkbox, Field, Input, Select, useToast } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { LOCALES } from "@/i18n/routing";
import { useErrorText } from "@/lib/hooks/use-error-text";
import { applyServerFieldErrors, errorCode } from "../forms/form-utils";

export function ProfileForm({ initial, email, emailVerified }: { initial: UpdateProfileInput; email: string; emailVerified: boolean }) {
  const t = useTranslations("account.profile");
  const tLocale = useTranslations("common.locale");
  const router = useRouter();
  const toast = useToast();
  const { validation, actionError } = useErrorText();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema) as unknown as Resolver<UpdateProfileInput>,
    defaultValues: initial,
    mode: "onTouched",
  });
  const { register, handleSubmit, formState, reset } = form;
  const err = (name: string) => {
    const code = errorCode(formState.errors, name);
    return code ? validation(code) : undefined;
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await updateProfileAction(values);
    if (result.ok) {
      toast.success(t("saved"));
      reset(values);
      router.refresh();
      return;
    }
    const unmapped = applyServerFieldErrors(form, result.fieldErrors);
    if (unmapped.length > 0 || !result.fieldErrors) setFormError(actionError(result));
  });

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-xl space-y-5">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <Field label={t("name")} error={err("name")} required>
        <Input autoComplete="name" {...register("name")} />
      </Field>

      <Field label={t("email")} hint={emailVerified ? t("emailVerified") : t("emailUnverified")}>
        <Input type="email" value={email} readOnly tabIndex={-1} />
      </Field>

      <Field label={t("phone")} error={err("phone")} optional>
        <Input type="tel" inputMode="tel" autoComplete="tel" {...register("phone")} />
      </Field>

      <Field label={t("locale")} hint={t("localeHint")} error={err("locale")}>
        <Select {...register("locale")}>
          {LOCALES.map((locale) => (
            <option key={locale} value={locale}>
              {tLocale(locale)}
            </option>
          ))}
        </Select>
      </Field>

      <Checkbox label={t("marketing")} description={t("marketingHint")} {...register("marketingOptIn")} />

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" loading={formState.isSubmitting} disabled={!formState.isDirty}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
