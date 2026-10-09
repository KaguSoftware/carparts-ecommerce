"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  "aria-label"?: string;
}

/** On/off toggle (role="switch"). Renders a hidden input when `name` is given so it works in plain forms. */
export function Switch({ checked, onCheckedChange, label, description, disabled, id, name, className, ...aria }: SwitchProps) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        aria-label={aria["aria-label"]}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "border-primary bg-primary" : "border-border-strong bg-surface-sunken",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute left-0.5 size-4.5 rounded-full shadow-sm transition-transform duration-200 ease-out-expo",
            checked ? "translate-x-5 bg-primary-foreground" : "translate-x-0 bg-muted",
          )}
        />
      </button>
      {name ? <input type="hidden" name={name} value={checked ? "true" : "false"} /> : null}
      {label || description ? (
        <label htmlFor={id} className="flex cursor-pointer flex-col gap-0.5">
          {label ? <span className="text-[0.9375rem] leading-snug text-foreground">{label}</span> : null}
          {description ? <span className="text-[0.8125rem] leading-snug text-muted">{description}</span> : null}
        </label>
      ) : null}
    </div>
  );
}
