"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { deleteAccountAction } from "@/actions/account/profile";
import { Alert, Button, Field, Input, Modal } from "@/components/ui";
import type { Locale } from "@/i18n/routing";
import { useErrorText } from "@/lib/hooks/use-error-text";

/** Danger zone: permanent account deletion, confirmed by retyping the account email. */
export function DeleteAccount({ email }: { email: string }) {
  const t = useTranslations("account.profile.delete");
  const locale = useLocale() as Locale;
  const { validation, actionError } = useErrorText();
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const matches = confirmEmail.trim().toLowerCase() === email.toLowerCase();

  function close() {
    if (pending) return;
    setOpen(false);
    setConfirmEmail("");
    setError(null);
    setFieldError(undefined);
  }

  function submit() {
    setError(null);
    setFieldError(undefined);
    startTransition(async () => {
      const result = await deleteAccountAction({ confirmEmail, locale });
      // On success the action redirects to the home page; we only get here with a failure.
      if (result && !result.ok) {
        const code = result.fieldErrors?.confirmEmail?.[0];
        if (code) setFieldError(validation(code));
        else setError(actionError(result));
      }
    });
  }

  return (
    <section aria-labelledby="danger-zone" className="max-w-xl rounded-md border border-danger/40 p-5 sm:p-6">
      <h2 id="danger-zone" className="display-4 flex items-center gap-2 text-danger">
        <TriangleAlert className="size-5" aria-hidden />
        {t("title")}
      </h2>
      <p className="mt-2 text-sm text-muted">{t("body")}</p>
      <Button variant="danger" className="mt-4" onClick={() => setOpen(true)}>
        {t("button")}
      </Button>

      <Modal
        open={open}
        onClose={close}
        dismissible={!pending}
        size="md"
        title={t("modalTitle")}
        description={t("modalBody")}
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={pending}>
              {t("cancel")}
            </Button>
            <Button variant="danger" onClick={submit} disabled={!matches} loading={pending}>
              {t("confirm")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Field label={t("confirmLabel", { email })} error={fieldError}>
            <Input type="email" autoComplete="off" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </section>
  );
}
