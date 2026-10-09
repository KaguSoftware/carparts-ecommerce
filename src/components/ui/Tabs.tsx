"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
  /** Small count/indicator after the label. */
  badge?: ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  defaultTab?: string;
  /** Controlled mode */
  value?: string;
  onValueChange?: (id: string) => void;
  "aria-label"?: string;
  className?: string;
}

/** WAI-ARIA tabs with roving tabindex and arrow/Home/End keys. Panels stay mounted (hidden) to keep form state. */
export function Tabs({ tabs, defaultTab, value, onValueChange, className, ...aria }: TabsProps) {
  const uid = useId().replace(/:/g, "");
  const [inner, setInner] = useState(defaultTab ?? tabs.find((t) => !t.disabled)?.id ?? "");
  const active = value ?? inner;
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const select = (id: string) => {
    if (value === undefined) setInner(id);
    onValueChange?.(id);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const enabled = tabs.filter((t) => !t.disabled);
    const idx = enabled.findIndex((t) => t.id === active);
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (idx + 1) % enabled.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + enabled.length) % enabled.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = enabled.length - 1;
    if (next === null) return;
    e.preventDefault();
    const target = enabled[next];
    if (target) {
      select(target.id);
      refs.current[target.id]?.focus();
    }
  };

  return (
    <div className={className}>
      <div role="tablist" aria-label={aria["aria-label"]} onKeyDown={onKeyDown} className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                refs.current[tab.id] = el;
              }}
              type="button"
              role="tab"
              id={`${uid}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${uid}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => select(tab.id)}
              className={cn(
                "label-caps -mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-[0.875rem] transition-colors disabled:opacity-40",
                selected ? "border-primary text-foreground" : "border-transparent text-muted hover:text-foreground",
              )}
            >
              {tab.label}
              {tab.badge}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${uid}-panel-${tab.id}`}
          aria-labelledby={`${uid}-tab-${tab.id}`}
          hidden={tab.id !== active}
          tabIndex={0}
          className="pt-5"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
