"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TabDef { id: string; label: string; count?: number; content: ReactNode }

export function Tabs({ tabs, initial }: { tabs: TabDef[]; initial?: string }) {
  const [active, setActive] = useState(initial ?? tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  return (
    <div>
      <div role="tablist" aria-label="Sections" className="scroll-slim mb-6 flex max-w-full gap-1 overflow-x-auto rounded-xl bg-ink-100/80 p-1 sm:inline-flex">
        {tabs.map((t) => (
          <button
            key={t.id} role="tab" type="button" id={`tab-${t.id}`} aria-selected={t.id === current?.id} aria-controls={`panel-${t.id}`}
            onClick={() => setActive(t.id)}
            className={cn(
              "whitespace-nowrap rounded-[9px] px-3.5 py-1.5 text-sm font-medium transition",
              t.id === current?.id ? "bg-surface text-ink-900 shadow-card" : "text-muted hover:text-ink-900",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className={cn("ml-2 rounded-full px-1.5 py-0.5 text-[11px] font-semibold", t.id === current?.id ? "bg-accent/40 text-ink-900" : "bg-ink-200/70 text-ink-700")}>{t.count}</span>}
          </button>
        ))}
      </div>
      {current && <div role="tabpanel" id={`panel-${current.id}`} aria-labelledby={`tab-${current.id}`} className="animate-rise">{current.content}</div>}
    </div>
  );
}
