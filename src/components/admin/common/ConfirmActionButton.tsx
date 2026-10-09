"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { ActionResult } from "@/lib/action-result";
import { Alert } from "@/components/ui/Alert";
import { Button, type ButtonProps } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useAdminAction } from "../forms/use-admin-action";

export interface ConfirmActionButtonProps {
  /** A server action already bound to its input: `deleteBrandAction.bind(null, { id })`. */
  action: () => Promise<ActionResult<unknown>>;
  children: ReactNode;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  success?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  tone?: "danger" | "primary";
  disabled?: boolean;
  leftIcon?: ReactNode;
  className?: string;
  "aria-label"?: string;
  onDone?: () => void;
}

/** A button that asks for confirmation in a dialog, then runs a server action and refreshes the page. */
export function ConfirmActionButton({ action, children, title, description, confirmLabel, success, variant = "ghost", size = "sm", tone = "danger", disabled, leftIcon, className, onDone, ...aria }: ConfirmActionButtonProps) {
  const t = useTranslations("admin.common");
  const [open, setOpen] = useState(false);
  const { run, pending, errorText, clearError } = useAdminAction();

  const close = () => {
    if (pending) return;
    setOpen(false);
    clearError();
  };

  return (
    <>
      <Button type="button" variant={variant} size={size} disabled={disabled} leftIcon={leftIcon} className={className} aria-label={aria["aria-label"]} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <Modal
        open={open}
        onClose={close}
        title={title}
        size="sm"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={close} disabled={pending}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant={tone === "danger" ? "danger" : "primary"}
              loading={pending}
              onClick={() =>
                void run(action, {
                  success,
                  toastError: false,
                  onSuccess: () => {
                    setOpen(false);
                    onDone?.();
                  },
                })
              }
            >
              {confirmLabel ?? t("confirm")}
            </Button>
          </>
        }
      >
        {description ? <p className="text-sm text-muted">{description}</p> : null}
        {errorText ? (
          <Alert tone="danger" className="mt-3">
            {errorText}
          </Alert>
        ) : null}
      </Modal>
    </>
  );
}
