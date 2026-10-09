"use client";

import { useTranslations } from "next-intl";
import { KeyRound, UserCheck, UserX } from "lucide-react";
import { sendPasswordResetAction, setUserDisabledAction } from "@/actions/admin/users";
import { ConfirmActionButton } from "../common/ConfirmActionButton";

export function CustomerActions({ id, name, disabled }: { id: string; name: string; disabled: boolean }) {
  const t = useTranslations("admin.customers.actions");
  return (
    <>
      <ConfirmActionButton
        variant="outline"
        size="sm"
        tone="primary"
        leftIcon={<KeyRound className="size-4" />}
        action={sendPasswordResetAction.bind(null, { id })}
        title={t("resetTitle", { name })}
        description={t("resetBody")}
        confirmLabel={t("resetConfirm")}
        success={t("resetSent")}
      >
        {t("reset")}
      </ConfirmActionButton>
      <ConfirmActionButton
        variant={disabled ? "outline" : "danger"}
        size="sm"
        tone={disabled ? "primary" : "danger"}
        leftIcon={disabled ? <UserCheck className="size-4" /> : <UserX className="size-4" />}
        action={setUserDisabledAction.bind(null, { id, disabled: !disabled })}
        title={disabled ? t("enableTitle", { name }) : t("disableTitle", { name })}
        description={disabled ? t("enableBody") : t("disableBody")}
        confirmLabel={disabled ? t("enable") : t("disable")}
        success={disabled ? t("enabled") : t("disabled")}
      >
        {disabled ? t("enable") : t("disable")}
      </ConfirmActionButton>
    </>
  );
}
