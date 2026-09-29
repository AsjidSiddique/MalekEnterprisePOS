"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface RowMenuItem { label: string; onSelect: () => void; danger?: boolean; hidden?: boolean }

export function RowMenu({ items, label = "Row actions" }: { items: RowMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const visible = items.filter((i) => !i.hidden);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  if (visible.length === 0) return null;
  return (
    <div className="relative inline-block text-left" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="rounded-field p-1.5 text-muted hover:bg-ink-100 hover:text-ink-900">
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-panel border border-line bg-surface py-1 shadow-lg">
          {visible.map((i) => (
            <button key={i.label} role="menuitem" type="button" onClick={() => { setOpen(false); i.onSelect(); }}
              className={cn("block w-full px-3.5 py-2 text-left text-sm hover:bg-paper", i.danger ? "text-[#A22B3B]" : "text-ink-800")}>
              {i.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
