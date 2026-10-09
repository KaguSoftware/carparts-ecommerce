"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Language and theme grouped behind one labelled control. Opens a small panel; Escape and outside clicks close it.
 * Intended for dark chrome (the storefront header): it inherits `currentColor`.
 */
export function PreferencesMenu({ className }: { className?: string }) {
  const t = useTranslations("ui.preferences");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>("button[aria-expanded]")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex h-11 items-center gap-2 px-2.5 text-current transition-colors hover:bg-current/10"
      >
        <SlidersHorizontal className="size-5" aria-hidden />
        <span className="tag-mono hidden xl:inline">{locale.toUpperCase()}</span>
        <span className="sr-only">{t("label")}</span>
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute right-0 top-full z-50 mt-2 w-64 border border-inverse-border bg-inverse-surface p-4 text-inverse-foreground shadow-lg"
      >
        <p className="tag-mono mb-2 text-inverse-muted">{t("language")}</p>
        <LocaleSwitcher className="-ml-1" />
        <p className="tag-mono mb-1 mt-4 border-t border-inverse-border pt-3 text-inverse-muted">{t("theme")}</p>
        <div className="-ml-2">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
