import { useTranslations } from "next-intl";
import { Badge, type BadgeTone } from "@/components/ui";
import type { OrderStatus, PaymentStatus } from "@/lib/types/domain";

const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  pending_payment: "warning",
  processing: "info",
  shipped: "info",
  delivered: "success",
  cancelled: "neutral",
  refunded: "neutral",
};

const PAYMENT_TONE: Record<PaymentStatus, BadgeTone> = {
  unpaid: "warning",
  paid: "success",
  failed: "danger",
  partially_refunded: "warning",
  refunded: "neutral",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const t = useTranslations("account.status");
  return (
    <Badge tone={STATUS_TONE[status]} dot>
      {t(status)}
    </Badge>
  );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const t = useTranslations("account.paymentStatus");
  return <Badge tone={PAYMENT_TONE[status]}>{t(status)}</Badge>;
}
