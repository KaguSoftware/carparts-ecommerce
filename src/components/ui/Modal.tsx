"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModalProps {
  open: boolean;
  /** Called for Esc, backdrop click and the close button. The parent owns `open`. */
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** `center` dialog (default) or a `right` / `left` slide-over drawer (cart, filters, admin forms). */
  placement?: "center" | "right" | "left";
  size?: "sm" | "md" | "lg" | "xl";
  /** Hide the visible title (kept for screen readers). */
  hideTitle?: boolean;
  /** Disable Esc / backdrop dismissal (e.g. mid-payment). */
  dismissible?: boolean;
  className?: string;
}

const sizes = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" } as const;

/**
 * Accessible modal built on the native <dialog>: top-layer rendering, inert background, focus trap,
 * Esc handling and focus restoration come from the browser. We add scroll lock, backdrop dismissal
 * and motion. Content is only mounted while open.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  placement = "center",
  size = "md",
  hideTitle,
  dismissible = true,
  className,
}: ModalProps) {
  const t = useTranslations("ui.modal");
  const ref = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const titleId = `m-${uid.replace(/:/g, "")}-t`;
  const descId = description ? `m-${uid.replace(/:/g, "")}-d` : undefined;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = prev;
    };
  }, [open]);

  const isDrawer = placement !== "center";

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descId}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      onClick={(e) => {
        if (dismissible && e.target === ref.current) onClose();
      }}
      className={cn(
        "m-0 max-h-none max-w-none overflow-visible bg-transparent p-0 text-foreground backdrop:animate-fade-in",
        isDrawer ? "h-dvh w-full" : "w-full",
        isDrawer && placement === "right" && "ml-auto",
        !isDrawer && "m-auto max-h-[90dvh] w-[calc(100%-2rem)]",
        !isDrawer && sizes[size],
      )}
    >
      {open ? (
        <div
          className={cn(
            "flex flex-col border border-border bg-surface shadow-lg",
            isDrawer
              ? cn("h-dvh w-full max-w-md border-y-0", placement === "right" ? "ml-auto animate-drawer-right border-r-0" : "mr-auto animate-drawer-left border-l-0")
              : "max-h-[90dvh] animate-dialog-in rounded-md",
            className,
          )}
        >
          <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 id={titleId} className={cn("display-3 text-[1.5rem]", hideTitle && "sr-only")}>
                {title}
              </h2>
              {description ? (
                <p id={descId} className="mt-1 text-sm text-muted">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("close")}
              className="-mr-2 -mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-sm text-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
            >
              <X className="size-5" aria-hidden />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          {footer ? <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-border px-5 py-4 sm:px-6">{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  );
}
