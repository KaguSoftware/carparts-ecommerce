import type { HTMLAttributes, ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type AlertTone = "info" | "success" | "warning" | "danger";

const tones: Record<AlertTone, { box: string; icon: typeof Info }> = {
  info: { box: "bg-info-soft text-info", icon: Info },
  success: { box: "bg-success-soft text-success", icon: CircleCheck },
  warning: { box: "bg-warning-soft text-warning", icon: TriangleAlert },
  danger: { box: "bg-danger-soft text-danger", icon: CircleAlert },
};

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: AlertTone;
  title?: ReactNode;
}

/** Inline message. Uses role=alert for danger/warning, role=status otherwise. */
export function Alert({ tone = "info", title, className, children, ...props }: AlertProps) {
  const { box, icon: Icon } = tones[tone];
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-md px-4 py-3 text-sm", box, className)}
      {...props}
    >
      <Icon className="mt-0.5 size-4.5 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-0.5">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-foreground/90">{children}</div> : null}
      </div>
    </div>
  );
}
