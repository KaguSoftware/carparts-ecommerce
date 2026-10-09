import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { controlBase, controlInvalid } from "./controls";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ invalid, className, rows = 4, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(controlBase, "min-h-24 resize-y px-3.5 py-2.5 text-base leading-relaxed", invalid && controlInvalid, className)}
      {...props}
    />
  );
}
