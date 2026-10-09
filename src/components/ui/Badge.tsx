import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "primary" | "accent" | "success" | "warning" | "danger" | "info" | "outline" | "inverse";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-sunken text-foreground",
  primary: "bg-primary text-primary-foreground",
  accent: "bg-accent text-accent-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  outline: "border border-border-strong text-muted",
  inverse: "bg-inverse text-inverse-foreground",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Small status dot before the label. */
  dot?: boolean;
}

export function Badge({ tone = "neutral", dot, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "label-caps inline-flex items-center gap-1.5 rounded-xs px-2 py-1 text-[0.75rem] leading-none whitespace-nowrap",
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
