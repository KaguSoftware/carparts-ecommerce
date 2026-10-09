import type { InputHTMLAttributes, ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: ReactNode;
  description?: ReactNode;
  invalid?: boolean;
  /** Use "radio" for single-choice groups. */
  type?: "checkbox" | "radio";
}

/** Checkbox / radio with a custom box. The real <input> stays in the DOM (peer) for forms and a11y. */
export function Checkbox({ label, description, invalid, type = "checkbox", className, id, ...props }: CheckboxProps) {
  return (
    <label className={cn("group flex cursor-pointer items-start gap-3 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60", className)}>
      <span className="relative mt-0.5 flex size-5 shrink-0">
        <input
          id={id}
          type={type}
          aria-invalid={invalid || undefined}
          className={cn(
            "peer absolute inset-0 size-5 cursor-[inherit] appearance-none border bg-surface transition-colors",
            type === "radio" ? "rounded-full" : "rounded-xs",
            invalid ? "border-danger" : "border-border-strong group-hover:border-muted",
            "checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
          )}
          {...props}
        />
        {type === "radio" ? (
          <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-primary-foreground transition-transform peer-checked:scale-100" />
        ) : (
          <Check aria-hidden strokeWidth={3.25} className="pointer-events-none absolute inset-0.5 size-4 scale-50 text-primary-foreground opacity-0 transition-[opacity,transform] peer-checked:scale-100 peer-checked:opacity-100" />
        )}
      </span>
      {label || description ? (
        <span className="flex flex-col gap-0.5">
          {label ? <span className="text-[0.9375rem] leading-snug text-foreground">{label}</span> : null}
          {description ? <span className="text-[0.8125rem] leading-snug text-muted">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}
