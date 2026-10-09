"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastTone = "success" | "error" | "info" | "warning";

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  tone?: ToastTone;
  /** ms; 0 = sticky. Default 5000 (errors 8000). */
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends Required<Pick<ToastOptions, "tone" | "duration">> {
  id: number;
  title: ReactNode;
  description?: ReactNode;
  action?: ToastOptions["action"];
}

interface ToastApi {
  toast: (opts: ToastOptions) => number;
  success: (title: ReactNode, description?: ReactNode) => number;
  error: (title: ReactNode, description?: ReactNode) => number;
  info: (title: ReactNode, description?: ReactNode) => number;
  warning: (title: ReactNode, description?: ReactNode) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const toneStyles: Record<ToastTone, { icon: typeof Info; bar: string; iconColor: string }> = {
  success: { icon: CircleCheck, bar: "bg-success", iconColor: "text-success" },
  error: { icon: CircleAlert, bar: "bg-danger", iconColor: "text-danger" },
  info: { icon: Info, bar: "bg-info", iconColor: "text-info" },
  warning: { icon: TriangleAlert, bar: "bg-warning", iconColor: "text-warning" },
};

const MAX_TOASTS = 4;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => setItems((cur) => cur.filter((t) => t.id !== id)), []);

  const toast = useCallback((opts: ToastOptions) => {
    const id = ++counter.current;
    const tone = opts.tone ?? "info";
    const item: ToastItem = {
      id,
      tone,
      duration: opts.duration ?? (tone === "error" ? 8000 : 5000),
      title: opts.title,
      description: opts.description,
      action: opts.action,
    };
    setItems((cur) => [...cur, item].slice(-MAX_TOASTS));
    return id;
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      dismiss,
      success: (title, description) => toast({ title, description, tone: "success" }),
      error: (title, description) => toast({ title, description, tone: "error" }),
      info: (title, description) => toast({ title, description, tone: "info" }),
      warning: (title, description) => toast({ title, description, tone: "warning" }),
    }),
    [toast, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: number) => void }) {
  const t = useTranslations("ui.toast");
  return (
    <div
      role="region"
      aria-label={t("region")}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end sm:p-6"
    >
      {items.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={onDismiss} dismissLabel={t("dismiss")} />
      ))}
    </div>
  );
}

function ToastCard({ item, onDismiss, dismissLabel }: { item: ToastItem; onDismiss: (id: number) => void; dismissLabel: string }) {
  const [paused, setPaused] = useState(false);
  const { icon: Icon, bar, iconColor } = toneStyles[item.tone];

  useEffect(() => {
    if (item.duration <= 0 || paused) return;
    const timer = setTimeout(() => onDismiss(item.id), item.duration);
    return () => clearTimeout(timer);
  }, [item.duration, item.id, onDismiss, paused]);

  return (
    <div
      role={item.tone === "error" ? "alert" : "status"}
      aria-live={item.tone === "error" ? "assertive" : "polite"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto relative flex w-full max-w-sm animate-toast-in items-start gap-3 overflow-hidden rounded-md border border-border bg-surface-raised py-3.5 pl-5 pr-3 shadow-lg"
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", bar)} />
      <Icon className={cn("mt-0.5 size-5 shrink-0", iconColor)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[0.9375rem] font-semibold leading-snug text-foreground">{item.title}</p>
        {item.description ? <p className="mt-0.5 text-sm leading-snug text-muted">{item.description}</p> : null}
        {item.action ? (
          <button
            type="button"
            onClick={() => {
              item.action?.onClick();
              onDismiss(item.id);
            }}
            className="mt-2 text-sm font-semibold text-primary-text underline underline-offset-4 hover:no-underline"
          >
            {item.action.label}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label={dismissLabel}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
