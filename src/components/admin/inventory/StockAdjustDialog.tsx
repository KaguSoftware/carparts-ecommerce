"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { adjustStockAction, setStockAction } from "@/actions/admin/inventory";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useErrorText } from "@/lib/hooks/use-error-text";
import { parseIntInput } from "../forms/form-utils";
import { useAdminAction } from "../forms/use-admin-action";

export interface StockTarget {
  variantId: string;
  sku: string;
  label: string;
  onHand: number;
  reserved: number;
}

const REASONS = ["purchase", "adjustment", "return", "damage", "correction"] as const;

/** Adjust (+/- delta) or count (absolute) the stock of one variant. Every change is recorded as an inventory movement. */
export function StockAdjustDialog({ target, onClose }: { target: StockTarget | null; onClose: () => void }) {
  return (
    <Modal open={target !== null} onClose={onClose} title={target ? target.sku : ""} size="md">
      {target ? <StockAdjustForm key={target.variantId} target={target} onClose={onClose} /> : null}
    </Modal>
  );
}

function StockAdjustForm({ target, onClose }: { target: StockTarget; onClose: () => void }) {
  const t = useTranslations("admin.inventory.adjust");
  const tr = useTranslations("admin.inventory.reasons");
  const { fieldError } = useErrorText();
  const { run, pending, error, errorText } = useAdminAction();
  const [mode, setMode] = useState<"delta" | "set">("delta");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<(typeof REASONS)[number]>("purchase");
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");

  const parsed = parseIntInput(amount);
  const preview = parsed === undefined ? null : mode === "delta" ? target.onHand + parsed : parsed;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const call =
      mode === "delta"
        ? () => adjustStockAction({ variantId: target.variantId, delta: parsed, reason, note: note || undefined, reference: reference || undefined })
        : () => setStockAction({ variantId: target.variantId, onHand: parsed, note: note || undefined });
    void run(call, { success: t("saved"), toastError: false, onSuccess: onClose });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <p className="text-sm text-muted">{target.label}</p>
      <dl className="grid grid-cols-3 gap-3 rounded-md bg-surface-sunken p-3 text-center">
        <div>
          <dt className="label-caps text-muted">{t("onHand")}</dt>
          <dd className="num font-display text-xl font-bold">{target.onHand}</dd>
        </div>
        <div>
          <dt className="label-caps text-muted">{t("reserved")}</dt>
          <dd className="num font-display text-xl font-bold">{target.reserved}</dd>
        </div>
        <div>
          <dt className="label-caps text-muted">{t("available")}</dt>
          <dd className="num font-display text-xl font-bold">{Math.max(0, target.onHand - target.reserved)}</dd>
        </div>
      </dl>

      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}

      <div role="radiogroup" aria-label={t("mode")} className="inline-flex overflow-hidden rounded-sm border border-border-strong">
        {(["delta", "set"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`label-caps px-3.5 py-2 text-[0.8125rem] ${mode === m ? "bg-secondary text-secondary-foreground" : "bg-surface text-muted hover:text-foreground"}`}
          >
            {t(`mode_${m}`)}
          </button>
        ))}
      </div>

      <Field
        label={mode === "delta" ? t("delta") : t("newOnHand")}
        hint={mode === "delta" ? t("deltaHint") : undefined}
        error={fieldError(error?.fieldErrors, mode === "delta" ? "delta" : "onHand")}
        required
      >
        <Input size="sm" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus placeholder={mode === "delta" ? "+10 / -2" : "0"} />
      </Field>
      {preview !== null ? <p className="num text-sm text-muted">{t("preview", { value: preview })}</p> : null}

      {mode === "delta" ? (
        <Field label={t("reason")}>
          <Select size="sm" value={reason} onChange={(e) => setReason(e.target.value as (typeof REASONS)[number])}>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {tr(r)}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field label={t("note")} optional error={fieldError(error?.fieldErrors, "note")}>
        <Input size="sm" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Field>
      {mode === "delta" ? (
        <Field label={t("reference")} optional hint={t("referenceHint")}>
          <Input size="sm" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={60} />
        </Field>
      ) : null}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
          {t("cancel")}
        </Button>
        <Button type="submit" loading={pending} disabled={parsed === undefined}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
