"use client";

import { useId, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, CircleCheck } from "lucide-react";
import { subscribeNewsletterAction } from "@/actions/store/newsletter";
import { Button } from "@/components/ui";
import { useErrorText } from "@/lib/hooks/use-error-text";

export function NewsletterForm({ source = "footer" }: { source?: string }) {
  const t = useTranslations("store.newsletter");
  const locale = useLocale();
  const uid = useId().replace(/:/g, "");
  const { fieldError, actionError } = useErrorText();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"new" | "existing" | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await subscribeNewsletterAction({ email, source, locale });
      if (result.ok) {
        setDone(result.data.alreadySubscribed ? "existing" : "new");
        setEmail("");
      } else {
        setError(fieldError(result.fieldErrors, "email") ?? actionError(result));
      }
    });
  }

  if (done) {
    return (
      <p role="status" className="flex items-start gap-2.5 text-[1.0625rem] font-medium">
        <CircleCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        {done === "new" ? t("success") : t("alreadySubscribed")}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="w-full max-w-lg">
      <label htmlFor={`nl-${uid}`} className="sr-only">
        {t("emailLabel")}
      </label>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <input
          id={`nl-${uid}`}
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          inputMode="email"
          placeholder={t("placeholder")}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `nl-${uid}-err` : undefined}
          className="h-12 min-w-0 flex-1 rounded-sm border border-inverse-border bg-inverse-surface px-4 text-base text-inverse-foreground placeholder:text-inverse-muted focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary"
        />
        <Button type="submit" size="lg" loading={pending} rightIcon={<ArrowRight className="size-4" aria-hidden />}>
          {t("submit")}
        </Button>
      </div>
      {error ? (
        <p id={`nl-${uid}-err`} role="alert" className="mt-2 text-sm font-medium text-accent">
          {error}
        </p>
      ) : (
        <p className="mt-2 text-[0.8125rem] text-inverse-muted">{t("privacy")}</p>
      )}
    </form>
  );
}
