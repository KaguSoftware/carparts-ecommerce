"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Ban, CheckCircle2, PackageCheck, Truck, Undo2 } from "lucide-react";
import { cancelOrderAction, deliverOrderAction, refundOrderAction, shipOrderAction, updateOrderStatusAction } from "@/actions/admin/orders";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { useErrorText } from "@/lib/hooks/use-error-text";
import type { OrderStatus, PaymentStatus } from "@/lib/types/domain";
import { ConfirmActionButton } from "../common/ConfirmActionButton";
import { parseIntInput } from "../forms/form-utils";
import { MoneyInput } from "../forms/NumberInputs";
import { ModalFormActions } from "../forms/FormParts";
import { useAdminAction } from "../forms/use-admin-action";

export interface OrderActionsProps {
  id: string;
  number: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  isPickup: boolean;
  carrier?: string;
  trackingNumber?: string;
  items: { id: string; name: string; variantName: string; sku: string; quantity: number; refundedQuantity: number }[];
  shippingRefunded: boolean;
  shippingCharged: number;
  refundable: number;
  canWrite: boolean;
  canRefund: boolean;
  /** Formatted refundable balance, e.g. "$120.00" */
  refundableLabel: string;
}

type Dialog = "ship" | "cancel" | "refund" | null;

export function OrderActions(props: OrderActionsProps) {
  const t = useTranslations("admin.orders.actions");
  const [dialog, setDialog] = useState<Dialog>(null);
  const { id, number, status, paymentStatus, canWrite, canRefund } = props;
  const paid = paymentStatus === "paid" || paymentStatus === "partially_refunded";
  const close = () => setDialog(null);

  if (!canWrite && !canRefund) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canWrite && status === "pending_payment" ? (
        <ConfirmActionButton
          variant="secondary"
          tone="primary"
          size="md"
          leftIcon={<CheckCircle2 className="size-4" />}
          action={updateOrderStatusAction.bind(null, { id, status: "processing" })}
          title={t("markPaidTitle", { number })}
          description={t("markPaidBody")}
          confirmLabel={t("markPaid")}
          success={t("markedPaid")}
        >
          {t("markPaid")}
        </ConfirmActionButton>
      ) : null}
      {canWrite && status === "processing" ? (
        <Button variant="secondary" leftIcon={<Truck className="size-4" />} onClick={() => setDialog("ship")}>
          {t("ship")}
        </Button>
      ) : null}
      {canWrite && status === "shipped" ? (
        <ConfirmActionButton
          variant="secondary"
          tone="primary"
          size="md"
          leftIcon={<PackageCheck className="size-4" />}
          action={deliverOrderAction.bind(null, { id })}
          title={t("deliverTitle", { number })}
          description={t("deliverBody")}
          confirmLabel={t("deliver")}
          success={t("delivered")}
        >
          {t("deliver")}
        </ConfirmActionButton>
      ) : null}
      {canRefund && paid && status !== "cancelled" && status !== "refunded" ? (
        <Button variant="outline" leftIcon={<Undo2 className="size-4" />} onClick={() => setDialog("refund")}>
          {t("refund")}
        </Button>
      ) : null}
      {canWrite && (status === "pending_payment" || status === "processing") ? (
        <Button variant="outline" leftIcon={<Ban className="size-4" />} onClick={() => setDialog("cancel")}>
          {t("cancel")}
        </Button>
      ) : null}

      <Modal open={dialog === "ship"} onClose={close} size="md" title={t("shipTitle", { number })}>
        {dialog === "ship" ? <ShipForm {...props} onClose={close} /> : null}
      </Modal>
      <Modal open={dialog === "cancel"} onClose={close} size="md" title={t("cancelTitle", { number })}>
        {dialog === "cancel" ? <CancelForm {...props} onClose={close} /> : null}
      </Modal>
      <Modal open={dialog === "refund"} onClose={close} size="lg" title={t("refundTitle", { number })} description={t("refundIntro", { amount: props.refundableLabel })}>
        {dialog === "refund" ? <RefundForm {...props} onClose={close} /> : null}
      </Modal>
    </div>
  );
}

function ShipForm({ id, isPickup, carrier: c0, trackingNumber: t0, onClose }: OrderActionsProps & { onClose: () => void }) {
  const t = useTranslations("admin.orders.actions");
  const { fieldError } = useErrorText();
  const { run, pending, error, errorText } = useAdminAction();
  const [carrier, setCarrier] = useState(c0 ?? "");
  const [tracking, setTracking] = useState(t0 ?? "");
  const [notify, setNotify] = useState(true);
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => shipOrderAction({ id, carrier, trackingNumber: tracking, notifyCustomer: notify }), { success: t("shipped"), toastError: false, onSuccess: onClose });
      }}
    >
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
      {isPickup ? <Alert tone="info">{t("pickupNote")}</Alert> : null}
      <Field label={t("carrier")} required={!isPickup} error={fieldError(error?.fieldErrors, "carrier")}>
        <Input size="sm" value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder={t("carrierPlaceholder")} autoFocus />
      </Field>
      <Field label={t("tracking")} required={!isPickup} error={fieldError(error?.fieldErrors, "trackingNumber")}>
        <Input size="sm" value={tracking} onChange={(e) => setTracking(e.target.value)} className="font-mono" />
      </Field>
      <Checkbox label={t("notify")} description={t("notifyHint")} checked={notify} onChange={(e) => setNotify(e.target.checked)} />
      <ModalFormActions pending={pending} onCancel={onClose} saveLabel={t("ship")} />
    </form>
  );
}

function CancelForm({ id, paymentStatus, canRefund, onClose }: OrderActionsProps & { onClose: () => void }) {
  const t = useTranslations("admin.orders.actions");
  const { fieldError } = useErrorText();
  const { run, pending, error, errorText } = useAdminAction();
  const paid = paymentStatus === "paid" || paymentStatus === "partially_refunded";
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(true);
  const [refund, setRefund] = useState(paid && canRefund);
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => cancelOrderAction({ id, reason, restock, refund: paid && canRefund ? refund : false }), { success: t("cancelled"), toastError: false, onSuccess: onClose });
      }}
    >
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
      <Field label={t("reason")} required error={fieldError(error?.fieldErrors, "reason")}>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} autoFocus />
      </Field>
      <Checkbox label={t("restock")} description={t("restockHint")} checked={restock} onChange={(e) => setRestock(e.target.checked)} />
      {paid ? (
        canRefund ? (
          <Checkbox label={t("refundToo")} description={t("refundTooHint")} checked={refund} onChange={(e) => setRefund(e.target.checked)} />
        ) : (
          <Alert tone="warning">{t("needAdminToRefund")}</Alert>
        )
      ) : null}
      <ModalFormActions pending={pending} onCancel={onClose} saveLabel={t("cancelConfirm")} />
    </form>
  );
}

function RefundForm({ id, items, shippingRefunded, shippingCharged, refundableLabel, onClose }: OrderActionsProps & { onClose: () => void }) {
  const t = useTranslations("admin.orders.actions");
  const { fieldError } = useErrorText();
  const { run, pending, error, errorText } = useAdminAction();
  const [mode, setMode] = useState<"all" | "items" | "amount">("all");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [includeShipping, setIncludeShipping] = useState(false);
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(true);

  const lines = items.map((i) => ({ orderItemId: i.id, quantity: Math.min(i.quantity - i.refundedQuantity, Math.max(0, parseIntInput(qty[i.id] ?? "") ?? 0)) }));

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => refundOrderAction({ id, mode, items: lines, includeShipping, amount, reason, restock }), { success: t("refunded"), toastError: false, onSuccess: onClose });
      }}
    >
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
      <div role="radiogroup" aria-label={t("refundMode")} className="grid gap-2 sm:grid-cols-3">
        {(["all", "items", "amount"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-md border px-3 py-2.5 text-left text-sm transition-colors ${mode === m ? "border-primary bg-primary-soft" : "border-border-strong hover:bg-surface-sunken"}`}
          >
            <span className="block font-medium">{t(`mode_${m}`)}</span>
            <span className="block text-[0.8125rem] text-muted">{t(`mode_${m}_hint`)}</span>
          </button>
        ))}
      </div>

      {mode === "all" ? <p className="text-sm text-muted">{t("allNote", { amount: refundableLabel })}</p> : null}

      {mode === "items" ? (
        <div className="space-y-3">
          <ul className="divide-y divide-border rounded-md border border-border">
            {items.map((i) => {
              const left = i.quantity - i.refundedQuantity;
              return (
                <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-medium">{i.name}</p>
                    <p className="num truncate text-xs text-muted">
                      {i.sku} · {t("refundable", { left, total: i.quantity })}
                    </p>
                  </div>
                  <Input
                    size="sm"
                    className="num w-20 text-right"
                    inputMode="numeric"
                    aria-label={t("qtyFor", { name: i.name })}
                    disabled={left <= 0}
                    placeholder="0"
                    value={qty[i.id] ?? ""}
                    onChange={(e) => setQty((cur) => ({ ...cur, [i.id]: e.target.value }))}
                    wrapperClassName="w-20"
                  />
                </li>
              );
            })}
          </ul>
          {shippingCharged > 0 && !shippingRefunded ? <Checkbox label={t("includeShipping")} checked={includeShipping} onChange={(e) => setIncludeShipping(e.target.checked)} /> : null}
          {fieldError(error?.fieldErrors, "items") ? (
            <p role="alert" className="text-[0.8125rem] font-medium text-danger">
              {fieldError(error?.fieldErrors, "items")}
            </p>
          ) : null}
        </div>
      ) : null}

      {mode === "amount" ? (
        <Field label={t("amount")} required hint={t("amountHint", { amount: refundableLabel })} error={fieldError(error?.fieldErrors, "amount")}>
          <MoneyInput size="sm" value={amount} onChange={setAmount} />
        </Field>
      ) : null}

      <Field label={t("reason")} required error={fieldError(error?.fieldErrors, "reason")}>
        <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      </Field>
      <Checkbox label={t("restock")} description={t("restockHint")} checked={restock} onChange={(e) => setRestock(e.target.checked)} />
      <Alert tone="info">{t("providerNote")}</Alert>
      <ModalFormActions pending={pending} onCancel={onClose} saveLabel={t("refundConfirm")} />
    </form>
  );
}
