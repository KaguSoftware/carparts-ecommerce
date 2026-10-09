"use client";

import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";
import { Button, Modal } from "@/components/ui";

export interface ThreeDSecureModalProps {
  open: boolean;
  /** Formatted amount the bank is asked to approve. */
  amount: string;
  busy: "approve" | "decline" | null;
  onDecision: (approved: boolean) => void;
}

/**
 * 3-D-Secure style challenge. With the mock gateway the "bank" is this dialog; a real provider would mount its own
 * hosted challenge here. It cannot be dismissed: the customer must approve or reject the payment.
 */
export function ThreeDSecureModal({ open, amount, busy, onDecision }: ThreeDSecureModalProps) {
  const t = useTranslations("checkout.threeDs");
  return (
    <Modal
      open={open}
      onClose={() => undefined}
      dismissible={false}
      size="sm"
      title={t("title")}
      description={t("body", { amount })}
      footer={
        <>
          <Button variant="ghost" onClick={() => onDecision(false)} loading={busy === "decline"} disabled={busy !== null}>
            {t("decline")}
          </Button>
          <Button onClick={() => onDecision(true)} loading={busy === "approve"} disabled={busy !== null}>
            {t("approve")}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-sm bg-info-soft p-4 text-sm text-info">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
        <p className="text-foreground/90">{t("explainer")}</p>
      </div>
      <p className="mt-4 text-sm text-muted" aria-live="polite">
        {busy ? t("processing") : t("waiting")}
      </p>
    </Modal>
  );
}
