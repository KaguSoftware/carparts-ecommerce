import type { ElementType, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const paddings = { none: "", sm: "p-4", md: "p-5 sm:p-6", lg: "p-6 sm:p-8" } as const;

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType<HTMLAttributes<HTMLElement>>;
  padding?: keyof typeof paddings;
  /** Raised cards get a soft shadow; flat cards are border-only (default, best for dense admin UI). */
  raised?: boolean;
  /** Lift on hover/focus-within for clickable cards. */
  interactive?: boolean;
}

/** Bordered surface. Do not nest Cards inside Cards: use dividers (border-t) or spacing instead. */
export function Card({ as: Tag = "div", padding = "md", raised, interactive, className, ...props }: CardProps) {
  return (
    <Tag
      className={cn(
        "rounded-md border border-border bg-surface text-foreground",
        paddings[padding],
        raised && "shadow-md",
        interactive &&
          "transition-[box-shadow,border-color,transform] duration-200 ease-out hover:border-border-strong hover:shadow-md focus-within:border-border-strong",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 flex flex-wrap items-start justify-between gap-3", className)} {...props} />;
}

export function CardTitle({ as: Tag = "h3", className, ...props }: HTMLAttributes<HTMLHeadingElement> & { as?: "h1" | "h2" | "h3" | "h4" }) {
  return <Tag className={cn("display-4", className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4", className)} {...props} />;
}
