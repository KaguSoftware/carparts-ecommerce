"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, MessageSquareReply, Trash2, X } from "lucide-react";
import { deleteReviewAction, replyToReviewAction, setReviewStatusAction } from "@/actions/admin/reviews";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { useErrorText } from "@/lib/hooks/use-error-text";
import { ConfirmActionButton } from "../common/ConfirmActionButton";
import { ModalFormActions } from "../forms/FormParts";
import { useAdminAction } from "../forms/use-admin-action";

export function ReviewActions({ id, status, reply, author }: { id: string; status: "pending" | "approved" | "rejected"; reply?: string; author: string }) {
  const t = useTranslations("admin.reviews.actions");
  const { run, pending } = useAdminAction();
  const [replying, setReplying] = useState(false);
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {status !== "approved" ? (
        <Button size="sm" variant="outline" disabled={pending} leftIcon={<Check className="size-4" />} onClick={() => void run(() => setReviewStatusAction({ id, status: "approved" }), { success: t("approved") })}>
          {t("approve")}
        </Button>
      ) : null}
      {status !== "rejected" ? (
        <Button size="sm" variant="outline" disabled={pending} leftIcon={<X className="size-4" />} onClick={() => void run(() => setReviewStatusAction({ id, status: "rejected" }), { success: t("rejected") })}>
          {t("reject")}
        </Button>
      ) : null}
      <Button size="icon-sm" variant="ghost" aria-label={t("reply", { author })} title={t("reply", { author })} onClick={() => setReplying(true)}>
        <MessageSquareReply className="size-4" />
      </Button>
      <ConfirmActionButton
        size="icon-sm"
        aria-label={t("delete", { author })}
        action={deleteReviewAction.bind(null, { id })}
        title={t("deleteTitle")}
        description={t("deleteBody")}
        confirmLabel={t("deleteConfirm")}
        success={t("deleted")}
      >
        <Trash2 className="size-4" />
      </ConfirmActionButton>
      <Modal open={replying} onClose={() => setReplying(false)} size="md" title={t("replyTitle", { author })} description={t("replyHint")}>
        {replying ? <ReplyForm id={id} initial={reply ?? ""} onClose={() => setReplying(false)} /> : null}
      </Modal>
    </div>
  );
}

function ReplyForm({ id, initial, onClose }: { id: string; initial: string; onClose: () => void }) {
  const t = useTranslations("admin.reviews.actions");
  const { fieldError } = useErrorText();
  const { run, pending, error, errorText } = useAdminAction();
  const [body, setBody] = useState(initial);
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => replyToReviewAction({ id, body }), { success: t("replied"), toastError: false, onSuccess: onClose });
      }}
    >
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
      <Field label={t("replyLabel")} required error={fieldError(error?.fieldErrors, "body")}>
        <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} autoFocus />
      </Field>
      <ModalFormActions pending={pending} onCancel={onClose} saveLabel={t("sendReply")} />
    </form>
  );
}
