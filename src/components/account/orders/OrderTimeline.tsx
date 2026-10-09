import { useFormatter, useTranslations } from "next-intl";
import { Check, CircleX, Clock, Package, PackageCheck, Truck, Undo2 } from "lucide-react";
import { Alert } from "@/components/ui";
import type { Order, OrderEvent, OrderStatus } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

const STEPS = ["placed", "processing", "shipped", "delivered"] as const;
type Step = (typeof STEPS)[number];

/** Index of the last completed step on the happy path. */
function reached(status: OrderStatus): number {
  switch (status) {
    case "pending_payment":
      return 0;
    case "processing":
      return 1;
    case "shipped":
      return 2;
    case "delivered":
    case "refunded":
      return 3;
    case "cancelled":
      return 0;
  }
}

const STEP_ICON: Record<Step, typeof Package> = { placed: Clock, processing: Package, shipped: Truck, delivered: PackageCheck };

/** Events customers should see. Free-text `note` events can carry staff wording, so they are never shown. */
const VISIBLE_EVENTS: OrderEvent["type"][] = ["created", "paid", "payment_failed", "status_changed", "shipped", "refund", "cancelled", "email_sent"];

/** Progress tracker plus the chronological event log of an order. */
export function OrderTimeline({ order }: { order: Order }) {
  const t = useTranslations("account");
  const format = useFormatter();
  const done = reached(order.status);
  const terminalOff = order.status === "cancelled" || order.status === "refunded";
  const events = order.events.filter((e) => VISIBLE_EVENTS.includes(e.type)).sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="space-y-8">
      {order.status === "cancelled" ? (
        <Alert tone="warning" title={t("timeline.cancelledTitle")}>
          {t("timeline.cancelledBody")}
        </Alert>
      ) : null}
      {order.status === "refunded" ? (
        <Alert tone="info" title={t("timeline.refundedTitle")}>
          {t("timeline.refundedBody")}
        </Alert>
      ) : null}
      {order.status === "pending_payment" ? <Alert tone="warning">{order.paymentStatus === "failed" ? t("timeline.paymentFailed") : t("timeline.awaitingPayment")}</Alert> : null}

      {order.status !== "cancelled" ? (
        <ol className="grid grid-cols-4 gap-2" aria-label={t("timeline.progress")}>
          {STEPS.map((step, index) => {
            const complete = index <= done && !(order.status === "pending_payment" && index > 0);
            const current = index === done && !terminalOff;
            const Icon = complete ? Check : STEP_ICON[step];
            return (
              <li key={step} aria-current={current ? "step" : undefined} className="relative flex flex-col items-center gap-2 text-center">
                {index > 0 ? <span aria-hidden className={cn("absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2", index <= done ? "bg-primary" : "bg-border")} /> : null}
                <span
                  className={cn(
                    "relative z-10 flex size-8 items-center justify-center rounded-full border-2",
                    complete ? "border-primary bg-primary text-primary-foreground" : "border-border-strong bg-surface text-muted",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className={cn("label-caps text-[0.75rem]", complete ? "text-foreground" : "text-muted")}>{t(`steps.${step}`)}</span>
              </li>
            );
          })}
        </ol>
      ) : null}

      <div>
        <h3 className="display-4">{t("timeline.title")}</h3>
        <ol className="mt-4 space-y-0">
          {events.map((event, index) => {
            const last = index === events.length - 1;
            const Icon = event.type === "cancelled" ? CircleX : event.type === "refund" ? Undo2 : event.type === "shipped" ? Truck : Check;
            return (
              <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
                {!last ? <span aria-hidden className="absolute left-[0.9375rem] top-8 h-[calc(100%-1.5rem)] w-px bg-border" /> : null}
                <span className="relative z-10 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-muted">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{eventLabel(t, event)}</p>
                  <time dateTime={event.at} className="num text-sm text-muted">
                    {format.dateTime(new Date(event.at), { dateStyle: "medium", timeStyle: "short" })}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function eventLabel(t: ReturnType<typeof useTranslations>, event: OrderEvent): string {
  if (event.type === "status_changed" && event.status) return t(`events.status_changed_${event.status}`);
  if (event.type === "created") return t("events.created");
  return t(`events.${event.type}`);
}
