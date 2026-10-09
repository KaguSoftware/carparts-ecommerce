"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Star } from "lucide-react";
import { z } from "zod";
import { submitReviewAction } from "@/actions/store/reviews";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import { useErrorText } from "@/lib/hooks/use-error-text";
import { cn } from "@/lib/utils";

const schema = z.object({
  rating: z.number({ error: "rating_required" }).int("rating_required").min(1, "rating_required").max(5, "rating_required"),
  title: z.string().trim().min(2, "required").max(120, "too_long"),
  body: z.string().trim().min(10, "too_short").max(4000, "too_long"),
  authorName: z.string().trim().max(60, "too_long"),
});
type Values = z.input<typeof schema>;

export function ReviewForm({ productId, signedIn }: { productId: string; signedIn: boolean }) {
  const t = useTranslations("store.reviews");
  const locale = useLocale();
  const { validation, actionError } = useErrorText();
  const [pending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", body: "", authorName: "" },
  });
  const rating = useWatch({ control, name: "rating" }) ?? 0;

  const err = (name: keyof Values) => {
    const msg = errors[name]?.message;
    return msg ? validation(String(msg)) : undefined;
  };

  function onSubmit(values: Values) {
    setFormError(null);
    if (!signedIn && !values.authorName.trim()) {
      setError("authorName", { message: "required" });
      return;
    }
    startTransition(async () => {
      const result = await submitReviewAction({ productId, locale, ...values });
      if (result.ok) {
        setSubmitted(true);
        return;
      }
      let handled = false;
      for (const key of ["rating", "title", "body", "authorName"] as const) {
        const code = result.fieldErrors?.[key]?.[0];
        if (code) {
          setError(key, { message: code });
          handled = true;
        }
      }
      if (!handled) setFormError(actionError(result));
    });
  }

  if (submitted) {
    return (
      <Alert tone="success" title={t("thanksTitle")}>
        {t("thanksBody")}
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          {t("yourRating")}
          <span className="ml-0.5 text-danger" aria-hidden>
            *
          </span>
        </legend>
        <div className="flex items-center gap-1" role="radiogroup" aria-label={t("yourRating")} aria-invalid={errors.rating ? true : undefined}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="relative cursor-pointer rounded-sm p-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-focus">
              <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setValue("rating", n, { shouldValidate: true })} className="sr-only" />
              <Star className={cn("size-8 transition-colors", n <= rating ? "fill-accent text-accent" : "text-border-strong hover:text-accent")} aria-hidden />
              <span className="sr-only">{t("starsLabel", { count: n })}</span>
            </label>
          ))}
        </div>
        {err("rating") ? (
          <p role="alert" className="mt-1.5 text-[0.8125rem] font-medium text-danger">
            {err("rating")}
          </p>
        ) : null}
      </fieldset>

      {!signedIn ? (
        <Field label={t("name")} error={err("authorName")} required>
          <Input {...register("authorName")} autoComplete="name" maxLength={60} />
        </Field>
      ) : null}
      <Field label={t("title")} error={err("title")} required>
        <Input {...register("title")} maxLength={120} placeholder={t("titlePlaceholder")} />
      </Field>
      <Field label={t("body")} error={err("body")} hint={t("bodyHint")} required>
        <Textarea {...register("body")} rows={5} maxLength={4000} />
      </Field>

      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <Button type="submit" loading={pending}>
        {t("submit")}
      </Button>
      <p className="text-[0.8125rem] text-muted">{t("moderationNote")}</p>
    </form>
  );
}
