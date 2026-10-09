"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ThumbsUp } from "lucide-react";
import { markReviewHelpfulAction } from "@/actions/store/reviews";
import { useToast } from "@/components/ui";
import { useErrorText } from "@/lib/hooks/use-error-text";
import { cn } from "@/lib/utils";

export function HelpfulButton({ reviewId, initialCount }: { reviewId: string; initialCount: number }) {
  const t = useTranslations("store.reviews");
  const toast = useToast();
  const { actionError } = useErrorText();
  const [count, setCount] = useState(initialCount);
  const [voted, setVoted] = useState(false);
  const [pending, startTransition] = useTransition();

  function vote() {
    startTransition(async () => {
      const result = await markReviewHelpfulAction({ reviewId });
      if (result.ok) {
        setCount(result.data.helpfulCount);
        setVoted(true);
      } else {
        toast.error(actionError(result));
      }
    });
  }

  return (
    <button
      type="button"
      onClick={vote}
      disabled={pending || voted}
      aria-pressed={voted}
      className={cn(
        "inline-flex min-h-9 items-center gap-2 rounded-sm border px-3 text-[0.8125rem] font-medium transition-colors",
        voted ? "border-primary bg-primary-soft text-foreground" : "border-border-strong text-muted hover:border-foreground hover:text-foreground",
      )}
    >
      <ThumbsUp className="size-4" aria-hidden />
      {voted ? t("helpfulThanks") : t("helpful")}
      {count > 0 ? <span className="num text-subtle">({count})</span> : null}
    </button>
  );
}
