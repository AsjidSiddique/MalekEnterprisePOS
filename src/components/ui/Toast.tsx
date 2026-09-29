"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, XCircle, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "info";
interface ToastItem { id: number; kind: ToastKind; message: string }
interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const icons = { success: CheckCircle2, error: XCircle, info: Info };
const accents = { success: "bg-live/20 text-live", error: "bg-signal/25 text-signal", info: "bg-info/25 text-[#8FB0FF]" };
const bars = { success: "bg-live", error: "bg-signal", info: "bg-info" };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((cur) => cur.filter((t) => t.id !== id)), []);
  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++;
    setItems((cur) => [...cur.slice(-3), { id, kind, message }]);
    window.setTimeout(() => dismiss(id), kind === "error" ? 7000 : 4000);
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    success: (m) => push("success", m), error: (m) => push("error", m), info: (m) => push("info", m),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2 p-4 sm:items-end" role="region" aria-label="Notifications" aria-live="polite">
        <AnimatePresence initial={false}>
          {items.map((t) => {
            const Icon = icons[t.kind];
            return (
              <motion.div
                key={t.id} layout
                initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.18 }}
                className="pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-2xl bg-ink-900/95 p-3.5 pr-3 text-white shadow-pop ring-1 ring-white/10 backdrop-blur"
                role={t.kind === "error" ? "alert" : "status"}
              >
                <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-xl", accents[t.kind])}><Icon className="h-[18px] w-[18px]" aria-hidden /></span>
                <p className="flex-1 pt-1 text-sm leading-snug text-white">{t.message}</p>
                <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="rounded-lg p-1 text-ink-300 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
                <motion.span aria-hidden className={cn("absolute inset-x-0 bottom-0 h-[3px] origin-left", bars[t.kind])} initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: t.kind === "error" ? 7 : 4, ease: "linear" }} />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
