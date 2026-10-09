"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Printer, RotateCcw, XCircle } from "lucide-react";
import { cancelOrderAction, reorderAction } from "@/actions/account/orders";
import { Alert, Button, Field, Modal, Textarea, useToast } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useErrorText } from "@/lib/hooks/use-error-text";

interface OrderActionsProps {
  number: string;
  canCancel: boolean;
  /** Paid orders are refunded on cancellation; the dialog says so. */
  isPaid: boolean;
}

/** Order detail toolbar: buy again, print, and customer cancellation (with a confirmation dialog). */
export function OrderActions({ number, canCancel, isPaid }: OrderActionsProps) {
  const t = useTranslations("account.order");
  const router = useRouter();
  const toast = useToast();
  const { actionError } = useErrorText();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cancelling, startCancel] = useTransition();
  const [reordering, startReorder] = useTransition();

  function reorder() {
    startReorder(async () => {
      const result = await reorderAction({ number });
      if (!result.ok) {
        toast.error(actionError(result));
        return;
      }
      if (result.data.added === 0) toast.warning(t("reorder.none"));
      else if (result.data.skipped > 0) toast.warning(t("reorder.partial", { added: result.data.added, skipped: result.data.skipped }));
      else toast.success(t("reorder.success"));
      router.refresh();
    });
  }

  function cancel() {
    setError(null);
    startCancel(async () => {
      const result = await cancelOrderAction({ number, reason: reason.trim() || undefined });
      if (!result.ok) {
        setError(actionError(result));
        return;
      }
      setOpen(false);
      toast.success(t("cancel.success"));
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-3 print:hidden">
        <Button variant="outline" onClick={reorder} loading={reordering} leftIcon={<RotateCcw className="size-4" aria-hidden />}>
          {t("reorder.button")}
        </Button>
        <Button variant="outline" onClick={() => window.print()} leftIcon={<Printer className="size-4" aria-hidden />}>
          {t("print")}
        </Button>
        {canCancel ? (
          <Button variant="ghost" onClick={() => setOpen(true)} leftIcon={<XCircle className="size-4" aria-hidden />}>
            {t("cancel.button")}
          </Button>
        ) : null}
      </div>

      <Modal
        open={open}
        onClose={() => (cancelling ? undefined : setOpen(false))}
        dismissible={!cancelling}
        title={t("cancel.title", { number })}
        description={isPaid ? t("cancel.paidBody") : t("cancel.unpaidBody")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={cancelling}>
              {t("cancel.keep")}
            </Button>
            <Button variant="danger" onClick={cancel} loading={cancelling}>
              {t("cancel.confirm")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Field label={t("cancel.reason")} optional>
            <Textarea rows={3} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
