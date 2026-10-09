"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { KeyRound, Plus, Trash2, UserCheck, UserX } from "lucide-react";
import { createStaffAction, deleteUserAction, sendPasswordResetAction, setUserDisabledAction, setUserRoleAction } from "@/actions/admin/users";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Table, TableContainer, TableEmpty, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { useErrorText } from "@/lib/hooks/use-error-text";
import { ConfirmActionButton } from "../common/ConfirmActionButton";
import { StatusBadge } from "../common/StatusBadge";
import { ModalFormActions } from "../forms/FormParts";
import { useAdminAction } from "../forms/use-admin-action";

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: "staff" | "admin";
  disabled: boolean;
  lastLoginAt?: string;
  createdAt: string;
  isSelf: boolean;
}

export function StaffManager({ rows }: { rows: StaffRow[] }) {
  const t = useTranslations("admin.staff");
  const format = useFormatter();
  const { run, pending } = useAdminAction();
  const [inviting, setInviting] = useState(false);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" leftIcon={<Plus className="size-4" />} onClick={() => setInviting(true)}>
          {t("invite")}
        </Button>
      </div>
      <TableContainer>
        <Table dense caption={t("title")}>
          <THead>
            <Tr>
              <Th>{t("cols.user")}</Th>
              <Th>{t("cols.role")}</Th>
              <Th>{t("cols.status")}</Th>
              <Th>{t("cols.lastLogin")}</Th>
              <Th className="w-px">
                <span className="sr-only">{t("cols.actions")}</span>
              </Th>
            </Tr>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <TableEmpty colSpan={5}>{t("empty")}</TableEmpty>
            ) : (
              rows.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    <span className="block font-medium">
                      {r.name}
                      {r.isSelf ? <Badge tone="outline" className="ml-2 px-1.5 py-0.5 text-[0.6875rem]">{t("you")}</Badge> : null}
                    </span>
                    <span className="block text-xs text-muted">{r.email}</span>
                  </Td>
                  <Td>
                    {r.isSelf ? (
                      <StatusBadge kind="role" value={r.role} />
                    ) : (
                      <Select
                        size="sm"
                        aria-label={t("roleFor", { name: r.name })}
                        value={r.role}
                        disabled={pending}
                        wrapperClassName="w-36"
                        onChange={(e) => void run(() => setUserRoleAction({ id: r.id, role: e.target.value }), { success: t("roleChanged") })}
                      >
                        <option value="staff">{t("roles.staff")}</option>
                        <option value="admin">{t("roles.admin")}</option>
                        <option value="customer">{t("roles.customer")}</option>
                      </Select>
                    )}
                  </Td>
                  <Td>
                    <StatusBadge kind="user" value={r.disabled ? "disabled" : "active"} />
                  </Td>
                  <Td className="whitespace-nowrap text-muted">{r.lastLoginAt ? format.dateTime(new Date(r.lastLoginAt), { dateStyle: "medium", timeStyle: "short" }) : t("never")}</Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <ConfirmActionButton
                        size="icon-sm"
                        tone="primary"
                        aria-label={t("reset", { name: r.name })}
                        action={sendPasswordResetAction.bind(null, { id: r.id })}
                        title={t("resetTitle", { name: r.name })}
                        description={t("resetBody")}
                        confirmLabel={t("resetConfirm")}
                        success={t("resetSent")}
                      >
                        <KeyRound className="size-4" />
                      </ConfirmActionButton>
                      {!r.isSelf ? (
                        <>
                          <ConfirmActionButton
                            size="icon-sm"
                            tone={r.disabled ? "primary" : "danger"}
                            aria-label={r.disabled ? t("enable", { name: r.name }) : t("disable", { name: r.name })}
                            action={setUserDisabledAction.bind(null, { id: r.id, disabled: !r.disabled })}
                            title={r.disabled ? t("enableTitle", { name: r.name }) : t("disableTitle", { name: r.name })}
                            description={r.disabled ? t("enableBody") : t("disableBody")}
                            confirmLabel={r.disabled ? t("enableConfirm") : t("disableConfirm")}
                            success={r.disabled ? t("enabled") : t("disabled")}
                          >
                            {r.disabled ? <UserCheck className="size-4" /> : <UserX className="size-4" />}
                          </ConfirmActionButton>
                          <ConfirmActionButton
                            size="icon-sm"
                            aria-label={t("delete", { name: r.name })}
                            action={deleteUserAction.bind(null, { id: r.id })}
                            title={t("deleteTitle", { name: r.name })}
                            description={t("deleteBody")}
                            confirmLabel={t("deleteConfirm")}
                            success={t("deleted")}
                          >
                            <Trash2 className="size-4" />
                          </ConfirmActionButton>
                        </>
                      ) : null}
                    </div>
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </TableContainer>

      <Modal open={inviting} onClose={() => setInviting(false)} size="md" title={t("inviteTitle")} description={t("inviteBody")}>
        {inviting ? <InviteForm onClose={() => setInviting(false)} /> : null}
      </Modal>
    </div>
  );
}

function InviteForm({ onClose }: { onClose: () => void }) {
  const t = useTranslations("admin.staff.form");
  const { fieldError } = useErrorText();
  const { run, pending, error, errorText } = useAdminAction();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"staff" | "admin">("staff");
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => createStaffAction({ name, email, role }), { success: t("created"), toastError: false, onSuccess: onClose });
      }}
    >
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
      <Field label={t("name")} required error={fieldError(error?.fieldErrors, "name")}>
        <Input size="sm" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={80} autoComplete="off" />
      </Field>
      <Field label={t("email")} required error={fieldError(error?.fieldErrors, "email")}>
        <Input size="sm" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
      </Field>
      <Field label={t("role")} hint={t("roleHint")} error={fieldError(error?.fieldErrors, "role")}>
        <Select size="sm" value={role} onChange={(e) => setRole(e.target.value as "staff" | "admin")}>
          <option value="staff">{t("staff")}</option>
          <option value="admin">{t("admin")}</option>
        </Select>
      </Field>
      <ModalFormActions pending={pending} onCancel={onClose} saveLabel={t("send")} />
    </form>
  );
}
