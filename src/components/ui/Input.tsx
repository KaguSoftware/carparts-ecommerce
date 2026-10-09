import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { controlBase, controlInvalid, controlSizes, type ControlSize } from "./controls";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: ControlSize;
  invalid?: boolean;
  /** Decorative node pinned inside the left edge (icon, currency symbol, prefix). */
  leading?: ReactNode;
  /** Node pinned inside the right edge (unit, button, icon). Pointer events enabled. */
  trailing?: ReactNode;
  wrapperClassName?: string;
}

export function Input({ size = "md", invalid, leading, trailing, className, wrapperClassName, ...props }: InputProps) {
  const input = (
    <input
      aria-invalid={invalid || undefined}
      className={cn(controlBase, controlSizes[size], invalid && controlInvalid, leading && "pl-10", trailing && "pr-11", className)}
      {...props}
    />
  );
  if (!leading && !trailing) return input;
  return (
    <div className={cn("relative", wrapperClassName)}>
      {leading ? (
        <span className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-muted [&_svg]:size-4">{leading}</span>
      ) : null}
      {input}
      {trailing ? <span className="absolute inset-y-0 right-0 flex min-w-10 items-center justify-center pr-1 text-muted [&_svg]:size-4">{trailing}</span> : null}
    </div>
  );
}
