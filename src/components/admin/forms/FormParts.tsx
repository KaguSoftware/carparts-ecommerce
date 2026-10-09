"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/Alert";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/** Titled form block. One level only: sections never nest. */
export function FormSection({ title, description, children, id }: { title: string; description?: string; children: ReactNode; id?: string }) {
  return (
    <Card as="section" id={id} padding="md" aria-labelledby={id ? `${id}-title` : undefined}>
      <h2 id={id ? `${id}-title` : undefined} className="display-4">
        {title}
      </h2>
      {description ? <p className="mt-1 mb-4 max-w-prose text-sm text-muted">{description}</p> : <div className="mb-4" />}
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

/** Banner shown above a form when a Server Action failed (field errors are shown inline). */
export function FormError({ text, fieldCount }: { text: string | null; fieldCount?: number }) {
  const t = useTranslations("admin.common");
  if (!text) return null;
  return (
    <Alert tone="danger" className="mb-4">
      {text}
      {fieldCount ? <span className="mt-0.5 block text-sm text-muted">{t("fixFields", { count: fieldCount })}</span> : null}
    </Alert>
  );
}

/** Sticky save bar for long forms. */
export function FormFooter({ pending, saveLabel, cancelHref, extra }: { pending: boolean; saveLabel?: string; cancelHref?: string; extra?: ReactNode }) {
  const t = useTranslations("admin.common");
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-border bg-surface/95 px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      {extra}
      <div className="flex-1" />
      {cancelHref ? (
        <Link href={cancelHref} className={buttonStyles({ variant: "ghost" })}>
          {t("cancel")}
        </Link>
      ) : null}
      <Button type="submit" loading={pending}>
        {saveLabel ?? t("saveChanges")}
      </Button>
    </div>
  );
}

/** Cancel + Save row at the bottom of a form that lives inside a dialog. */
export function ModalFormActions({ pending, onCancel, saveLabel }: { pending: boolean; onCancel: () => void; saveLabel?: string }) {
  const t = useTranslations("admin.common");
  return (
    <div className="flex justify-end gap-2 border-t border-border pt-4">
      <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
        {t("cancel")}
      </Button>
      <Button type="submit" loading={pending}>
        {saveLabel ?? t("save")}
      </Button>
    </div>
  );
}
