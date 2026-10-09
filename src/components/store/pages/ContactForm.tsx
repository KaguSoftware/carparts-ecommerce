"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CircleCheck } from "lucide-react";
import { z } from "zod";
import { submitContactAction } from "@/actions/store/contact";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import { useErrorText } from "@/lib/hooks/use-error-text";
import { emailSchema } from "@/lib/validation/common";

const schema = z.object({
  name: z.string().trim().min(1, "required").max(80, "too_long"),
  email: emailSchema,
  phone: z.string().trim().max(20, "too_long"),
  orderNumber: z.string().trim().max(30, "too_long"),
  subject: z.string().trim().min(2, "required").max(150, "too_long"),
  message: z.string().trim().min(10, "too_short").max(5000, "too_long"),
});
type Values = z.input<typeof schema>;
const FIELDS = ["name", "email", "phone", "orderNumber", "subject", "message"] as const;

export function ContactForm({ defaultName = "", defaultEmail = "" }: { defaultName?: string; defaultEmail?: string }) {
  const t = useTranslations("store.contact");
  const locale = useLocale() as "en" | "tr";
  const { validation, actionError } = useErrorText();
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: defaultName, email: defaultEmail, phone: "", orderNumber: "", subject: "", message: "" } });

  const err = (name: keyof Values) => {
    const msg = errors[name]?.message;
    return msg ? validation(String(msg)) : undefined;
  };

  function onSubmit(values: Values) {
    setFormError(null);
    startTransition(async () => {
      const result = await submitContactAction({ ...values, locale });
      if (result.ok) {
        setSent(true);
        reset();
        return;
      }
      let handled = false;
      for (const key of FIELDS) {
        const code = result.fieldErrors?.[key]?.[0];
        if (code) {
          setError(key, { message: code });
          handled = true;
        }
      }
      if (!handled) setFormError(actionError(result));
    });
  }

  if (sent) {
    return (
      <div role="status" className="flex items-start gap-4 rounded-md border border-border bg-surface p-6">
        <CircleCheck className="mt-0.5 size-7 shrink-0 text-success" aria-hidden />
        <div>
          <p className="display-4">{t("sentTitle")}</p>
          <p className="mt-1.5 text-muted">{t("sentBody")}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setSent(false)}>
            {t("sendAnother")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("name")} error={err("name")} required>
          <Input {...register("name")} autoComplete="name" maxLength={80} />
        </Field>
        <Field label={t("email")} error={err("email")} required>
          <Input {...register("email")} type="email" autoComplete="email" inputMode="email" maxLength={254} />
        </Field>
        <Field label={t("phone")} error={err("phone")} optional>
          <Input {...register("phone")} type="tel" autoComplete="tel" inputMode="tel" maxLength={20} />
        </Field>
        <Field label={t("orderNumber")} error={err("orderNumber")} hint={t("orderNumberHint")} optional>
          <Input {...register("orderNumber")} autoComplete="off" maxLength={30} className="uppercase" />
        </Field>
      </div>
      <Field label={t("subject")} error={err("subject")} required>
        <Input {...register("subject")} maxLength={150} />
      </Field>
      <Field label={t("message")} error={err("message")} hint={t("messageHint")} required>
        <Textarea {...register("message")} rows={7} maxLength={5000} />
      </Field>
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <Button type="submit" size="lg" loading={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}
