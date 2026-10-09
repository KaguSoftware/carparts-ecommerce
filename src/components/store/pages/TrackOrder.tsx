"use client";

import { useState, useTransition } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Check, PackageSearch } from "lucide-react";
import { z } from "zod";
import { trackOrderAction } from "@/actions/store/track-order";
import type { TrackedOrder } from "@/actions/store/track-order.types";
import { Alert, Badge, Button, Field, Input } from "@/components/ui";
import { useErrorText } from "@/lib/hooks/use-error-text";
import { localize } from "@/lib/i18n-string";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { ProductThumb } from "../product/ProductThumb";
import { emailSchema } from "@/lib/validation/common";

const schema = z.object({
  number: z.string().trim().min(3, "required").max(30, "too_long"),
  email: emailSchema,
});
type Values = z.input<typeof schema>;

const STEPS = ["placed", "processing", "shipped", "delivered"] as const;
const stepIndex = (status: TrackedOrder["status"]) => (status === "pending_payment" ? 0 : status === "processing" ? 1 : status === "shipped" ? 2 : status === "delivered" ? 3 : -1);

export function TrackOrder({ defaultEmail = "", defaultNumber = "" }: { defaultEmail?: string; defaultNumber?: string }) {
  const t = useTranslations("store.track");
  const locale = useLocale();
  const format = useFormatter();
  const { validation, actionError } = useErrorText();
  const [pending, startTransition] = useTransition();
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { number: defaultNumber, email: defaultEmail } });
  const err = (name: keyof Values) => {
    const msg = errors[name]?.message;
    return msg ? validation(String(msg)) : undefined;
  };

  function onSubmit(values: Values) {
    setFormError(null);
    setOrder(null);
    startTransition(async () => {
      const result = await trackOrderAction(values);
      if (result.ok) {
        setOrder(result.data);
        return;
      }
      let handled = false;
      for (const key of ["number", "email"] as const) {
        const code = result.fieldErrors?.[key]?.[0];
        if (code) {
          setError(key, { message: code });
          handled = true;
        }
      }
      if (!handled) setFormError(result.error === "order_not_found" ? t("notFound") : actionError(result));
    });
  }

  const money = order ? (cents: number) => formatMoney(cents, locale, { currency: order.currency, rate: order.fxRate }) : null;
  const current = order ? stepIndex(order.status) : -1;
  const dt = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });

  return (
    <div className="space-y-10">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid max-w-3xl gap-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label={t("orderNumber")} error={err("number")} required>
          <Input {...register("number")} autoComplete="off" autoCapitalize="characters" placeholder="AX-100482" className="uppercase" />
        </Field>
        <Field label={t("email")} error={err("email")} required>
          <Input {...register("email")} type="email" autoComplete="email" inputMode="email" />
        </Field>
        <Button type="submit" size="lg" loading={pending} leftIcon={<PackageSearch className="size-5" aria-hidden />}>
          {t("submit")}
        </Button>
      </form>

      <div aria-live="polite">
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        {order && money ? (
          <section aria-labelledby="tracked-heading" className="space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
              <div>
                <h2 id="tracked-heading" className="display-3">
                  {t("orderTitle", { number: order.number })}
                </h2>
                <p className="mt-1 text-sm text-muted">{t("placedOn", { date: dt(order.createdAt) })}</p>
              </div>
              <Badge tone={order.status === "cancelled" || order.status === "refunded" ? "danger" : order.status === "delivered" ? "success" : "info"} dot>
                {t(`status.${order.status}`)}
              </Badge>
            </div>

            {current >= 0 ? (
              <ol className="grid gap-4 sm:grid-cols-4" aria-label={t("progress")}>
                {STEPS.map((step, i) => {
                  const done = i <= current;
                  return (
                    <li key={step} aria-current={i === current ? "step" : undefined} className="relative">
                      <div className="flex items-center gap-3 sm:flex-col sm:items-start">
                        <span
                          className={cn(
                            "inline-flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold",
                            done ? "border-primary bg-primary text-primary-foreground" : "border-border-strong text-subtle",
                          )}
                        >
                          {done && i < current ? <Check className="size-4" strokeWidth={3} aria-hidden /> : <span className="num">{i + 1}</span>}
                        </span>
                        <span className={cn("font-display text-lg font-semibold uppercase tracking-wide", done ? "text-foreground" : "text-subtle")}>{t(`steps.${step}`)}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <Alert tone="warning">{order.status === "refunded" ? t("refundedNote") : t("cancelledNote")}</Alert>
            )}

            {order.trackingNumber ? (
              <div className="rounded-md border border-border bg-surface p-5">
                <p className="display-4">{t("shipment")}</p>
                <dl className="mt-3 grid gap-x-8 gap-y-2 text-[0.9375rem] sm:grid-cols-2">
                  {order.carrier ? (
                    <div>
                      <dt className="text-muted">{t("carrier")}</dt>
                      <dd className="font-medium">{order.carrier}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-muted">{t("trackingNumber")}</dt>
                    <dd className="num font-medium">{order.trackingNumber}</dd>
                  </div>
                  {order.shippedAt ? (
                    <div>
                      <dt className="text-muted">{t("shippedOn")}</dt>
                      <dd className="font-medium">{dt(order.shippedAt)}</dd>
                    </div>
                  ) : null}
                  {order.deliveredAt ? (
                    <div>
                      <dt className="text-muted">{t("deliveredOn")}</dt>
                      <dd className="font-medium">{dt(order.deliveredAt)}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            ) : (
              <p className="text-muted">
                {t("estimate", { method: localize(order.shippingMethod, locale), min: order.estimatedDays.min, max: order.estimatedDays.max, city: order.destination.city })}
              </p>
            )}

            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <ul className="divide-y divide-border border-y border-border">
                {order.items.map((item, i) => (
                  <li key={i} className="flex gap-4 py-4">
                    <ProductThumb src={item.image} alt="" className="size-16" sizes="64px" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-snug">{localize(item.name, locale)}</p>
                      <p className="text-[0.8125rem] text-muted">
                        {item.brandName} · {localize(item.variantName, locale)}
                      </p>
                      <p className="num text-[0.8125rem] text-muted">{t("qty", { count: item.quantity })}</p>
                    </div>
                    <p className="num font-display text-lg font-bold">{money(item.lineTotal)}</p>
                  </li>
                ))}
              </ul>
              <dl className="space-y-2 text-[0.9375rem]">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">{t("subtotal")}</dt>
                  <dd className="num">{money(order.subtotal)}</dd>
                </div>
                {order.discount > 0 ? (
                  <div className="flex justify-between gap-4 text-success">
                    <dt>{t("discount")}</dt>
                    <dd className="num">-{money(order.discount)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">{t("shipping")}</dt>
                  <dd className="num">{order.shipping === 0 ? t("free") : money(order.shipping)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">{t("tax")}</dt>
                  <dd className="num">{money(order.tax)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 border-t border-border pt-3">
                  <dt className="font-display text-lg font-bold uppercase">{t("total")}</dt>
                  <dd className="num font-display text-2xl font-bold">{money(order.total)}</dd>
                </div>
              </dl>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
