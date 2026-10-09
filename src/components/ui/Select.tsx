import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { controlBase, controlInvalid, controlSizes, type ControlSize } from "./controls";

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  size?: ControlSize;
  invalid?: boolean;
  wrapperClassName?: string;
}

/** Native <select> (best mobile UX + a11y) with themed chrome. Pass <option>s as children. */
export function Select({ size = "md", invalid, className, wrapperClassName, children, ...props }: SelectProps) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <select
        aria-invalid={invalid || undefined}
        className={cn(controlBase, controlSizes[size], "appearance-none pr-10", invalid && controlInvalid, className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
    </div>
  );
}
