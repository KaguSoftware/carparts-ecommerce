"use client";

import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Step {
  id: string;
  label: string;
  /** Mono summary of what was entered, shown once the step is complete. */
  summary?: string;
  done: boolean;
  /** Shown instead of "to do" while the step is not done but already holds a preselected value (e.g. the default shipping method). */
  pending?: string;
}

/**
 * The four checkout stages as a bordered tab strip: 01 CONTACT / 02 SHIP TO / 03 METHOD / 04 PAYMENT. Finished steps
 * show a tick and a one-line mono summary; every cell jumps to its section.
 */
export function StepStrip({ steps }: { steps: Step[] }) {
  const t = useTranslations("checkout.steps");
  return (
    <nav aria-label={t("label")} className="bg-background lg:sticky lg:top-0 lg:z-30 lg:-mx-1 lg:px-1 lg:py-2">
      <ol className="grid grid-cols-2 border border-border-strong bg-surface lg:grid-cols-4">
        {steps.map((step, i) => (
          <li key={step.id} className={cn("min-w-0 border-border-strong", i % 2 === 1 && "border-l", i >= 2 && "border-t lg:border-t-0", i > 0 && "lg:border-l")}>
            <a href={`#${step.id}`} className="group flex min-h-16 flex-col justify-center gap-0.5 px-3.5 py-2.5 transition-colors hover:bg-surface-sunken">
              <span className="tag-mono flex items-center gap-2 text-foreground">
                <span className="text-primary-text">{String(i + 1).padStart(2, "0")}</span>
                {step.label}
                {step.done ? (
                  <>
                    <Check className="ml-auto size-3.5 text-success" strokeWidth={3} aria-hidden />
                    <span className="sr-only">{t("done")}</span>
                  </>
                ) : null}
              </span>
              <span className={cn("mono text-[0.75rem]", !step.done && step.pending ? "line-clamp-2 break-words" : "truncate", step.done ? "text-muted" : "text-subtle")}>{step.done && step.summary ? step.summary : (step.pending ?? t("todo"))}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
