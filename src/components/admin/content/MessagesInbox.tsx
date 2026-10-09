"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Mail, Trash2 } from "lucide-react";
import { deleteMessageAction, updateMessageAction } from "@/actions/admin/content";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Table, TableContainer, TableEmpty, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/utils";
import { ConfirmActionButton } from "../common/ConfirmActionButton";
import { StatusBadge } from "../common/StatusBadge";
import { useAdminAction } from "../forms/use-admin-action";

export interface MessageRow {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  orderNumber?: string;
  locale: "en" | "tr";
  status: "new" | "read" | "replied" | "archived";
  adminNotes?: string;
  createdAt: string;
}

const STATUSES = ["new", "read", "replied", "archived"] as const;

export function MessagesInbox({ rows, canWrite }: { rows: MessageRow[]; canWrite: boolean }) {
  const t = useTranslations("admin.messages");
  const format = useFormatter();
  const { run } = useAdminAction();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = rows.find((r) => r.id === openId) ?? null;

  function openRow(row: MessageRow) {
    setOpenId(row.id);
    if (canWrite && row.status === "new") void run(() => updateMessageAction({ id: row.id, status: "read" }), { toastError: false });
  }

  return (
    <>
      <TableContainer>
        <Table dense caption={t("title")}>
          <THead>
            <Tr>
              <Th>{t("cols.from")}</Th>
              <Th>{t("cols.subject")}</Th>
              <Th>{t("cols.status")}</Th>
              <Th>{t("cols.received")}</Th>
            </Tr>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <TableEmpty colSpan={4}>{t("empty")}</TableEmpty>
            ) : (
              rows.map((r) => (
                <Tr key={r.id} clickable>
                  <Td>
                    <button type="button" onClick={() => openRow(r)} className={cn("block text-left hover:text-primary-text hover:underline", r.status === "new" && "font-semibold")}>
                      {r.name}
                    </button>
                    <span className="block text-xs text-muted">{r.email}</span>
                  </Td>
                  <Td className="max-w-md">
                    <span className={cn("block truncate", r.status === "new" && "font-semibold")}>{r.subject}</span>
                    <span className="block truncate text-xs text-muted">{r.message}</span>
                  </Td>
                  <Td>
                    <StatusBadge kind="contact" value={r.status} />
                  </Td>
                  <Td className="whitespace-nowrap text-muted">{format.dateTime(new Date(r.createdAt), { dateStyle: "medium", timeStyle: "short" })}</Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </TableContainer>

      <Modal open={open !== null} onClose={() => setOpenId(null)} placement="right" size="lg" title={open?.subject ?? ""}>
        {open ? <MessageDetail key={open.id} row={open} canWrite={canWrite} onClose={() => setOpenId(null)} /> : null}
      </Modal>
    </>
  );
}

function MessageDetail({ row, canWrite, onClose }: { row: MessageRow; canWrite: boolean; onClose: () => void }) {
  const t = useTranslations("admin.messages.detail");
  const format = useFormatter();
  const { run, pending } = useAdminAction();
  const [notes, setNotes] = useState(row.adminNotes ?? "");

  return (
    <div className="space-y-5">
      <dl className="space-y-1 text-sm">
        <div className="flex gap-3">
          <dt className="w-20 shrink-0 text-muted">{t("from")}</dt>
          <dd>
            {row.name} &lt;
            <a href={`mailto:${row.email}?subject=${encodeURIComponent(`Re: ${row.subject}`)}`} className="text-primary-text underline underline-offset-2">
              {row.email}
            </a>
            &gt;
          </dd>
        </div>
        {row.phone ? (
          <div className="flex gap-3">
            <dt className="w-20 shrink-0 text-muted">{t("phone")}</dt>
            <dd className="num">{row.phone}</dd>
          </div>
        ) : null}
        {row.orderNumber ? (
          <div className="flex gap-3">
            <dt className="w-20 shrink-0 text-muted">{t("order")}</dt>
            <dd className="num">{row.orderNumber}</dd>
          </div>
        ) : null}
        <div className="flex gap-3">
          <dt className="w-20 shrink-0 text-muted">{t("received")}</dt>
          <dd>
            {format.dateTime(new Date(row.createdAt), { dateStyle: "medium", timeStyle: "short" })} · {row.locale.toUpperCase()}
          </dd>
        </div>
      </dl>
      <p className="whitespace-pre-wrap rounded-md bg-surface-sunken p-4 text-sm leading-relaxed">{row.message}</p>

      {canWrite ? (
        <>
          <div>
            <p className="label-caps mb-2 text-muted">{t("status")}</p>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={row.status === s ? "secondary" : "outline"}
                  aria-pressed={row.status === s}
                  disabled={pending || row.status === s}
                  onClick={() => void run(() => updateMessageAction({ id: row.id, status: s }), { success: t("updated") })}
                >
                  {t(`mark_${s}`)}
                </Button>
              ))}
            </div>
          </div>
          <Field label={t("notes")} hint={t("notesHint")}>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            <ConfirmActionButton
              variant="ghost"
              leftIcon={<Trash2 className="size-4" />}
              action={deleteMessageAction.bind(null, { id: row.id })}
              title={t("deleteTitle")}
              description={t("deleteBody")}
              confirmLabel={t("deleteConfirm")}
              success={t("deleted")}
              onDone={onClose}
            >
              {t("delete")}
            </ConfirmActionButton>
            <div className="flex gap-2">
              <a
                href={`mailto:${row.email}?subject=${encodeURIComponent(`Re: ${row.subject}`)}`}
                onClick={() => void run(() => updateMessageAction({ id: row.id, status: "replied" }), { toastError: false })}
                className="inline-flex h-9 items-center gap-2 rounded-sm border border-border-strong px-3.5 font-display text-[0.8125rem] font-semibold uppercase tracking-[0.06em] hover:bg-surface-sunken"
              >
                <Mail className="size-4" aria-hidden />
                {t("reply")}
              </a>
              <Button size="sm" loading={pending} onClick={() => void run(() => updateMessageAction({ id: row.id, adminNotes: notes }), { success: t("notesSaved") })}>
                {t("saveNotes")}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
