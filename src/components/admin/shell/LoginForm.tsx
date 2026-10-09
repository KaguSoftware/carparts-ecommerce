"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LogIn } from "lucide-react";
import { adminSignInAction } from "@/actions/admin/auth";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { useErrorText } from "@/lib/hooks/use-error-text";
import { useAdminAction } from "../forms/use-admin-action";

export function LoginForm({ next, customerHint }: { next: string; customerHint?: boolean }) {
  const t = useTranslations("admin.login");
  const { fieldError } = useErrorText();
  const { run, pending, error, errorText } = useAdminAction();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => adminSignInAction({ email, password, next }), { toastError: false, refresh: false });
      }}
    >
      {customerHint ? <Alert tone="warning">{t("customerSession")}</Alert> : null}
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
      <Field label={t("email")} error={fieldError(error?.fieldErrors, "email")} required>
        <Input name="email" type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label={t("password")} error={fieldError(error?.fieldErrors, "password")} required>
        <Input name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit" fullWidth loading={pending} leftIcon={<LogIn className="size-4" />}>
        {t("submit")}
      </Button>
    </form>
  );
}
