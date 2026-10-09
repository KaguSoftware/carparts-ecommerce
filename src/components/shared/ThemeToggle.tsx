"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEME_STORAGE_KEY as STORAGE_KEY } from "./theme-script";

type Theme = "system" | "light" | "dark";

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

function readStored(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

const order: Theme[] = ["system", "light", "dark"];

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const subscribeNever = () => () => {};

/** Cycles system -> light -> dark. Persists per-viewer in localStorage (convenience only). */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("ui.theme");
  const theme = useSyncExternalStore(subscribe, readStored, () => "system" as Theme);
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);

  const cycle = () => {
    const next = order[(order.indexOf(theme) + 1) % order.length] ?? "system";
    apply(next);
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable: the theme still applies for this page view */
    }
    listeners.forEach((l) => l());
  };

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={mounted ? t("toggle", { current: t(theme) }) : t("toggleShort")}
      title={mounted ? t(theme) : undefined}
      className={cn("inline-flex size-10 items-center justify-center rounded-sm text-current transition-colors hover:bg-current/10", className)}
    >
      <Icon className="size-5" aria-hidden />
    </button>
  );
}
