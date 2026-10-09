"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { addOrderNoteAction } from "@/actions/admin/orders";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";
import { useErrorText } from "@/lib/hooks/use-error-text";
import { useAdminAction } from "../forms/use-admin-action";

/** Internal note on an order (never visible to the customer). */
export function OrderNoteForm({ id }: { id: string }) {
  const t = useTranslations("admin.orders.detail");
  const { fieldError } = useErrorText();
  const { run, pending, error, errorText } = useAdminAction();
  const [body, setBody] = useState("");
  return (
    <form
      noValidate
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => addOrderNoteAction({ id, body }), { success: t("noteAdded"), toastError: false, onSuccess: () => setBody("") });
      }}
    >
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
      <Field label={t("addNote")} hideLabel error={fieldError(error?.fieldErrors, "body")}>
        <Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("notePlaceholder")} maxLength={2000} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="secondary" loading={pending} disabled={!body.trim()}>
          {t("addNoteButton")}
        </Button>
      </div>
    </form>
  );
}
