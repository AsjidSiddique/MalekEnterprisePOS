"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Field } from "./Field";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}

const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" };
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, title, description, children, footer, size = "md" }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = panelRef.current?.querySelector<HTMLElement>("[data-autofocus], input, select, textarea") ?? panelRef.current;
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onCloseRef.current();
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const firstEl = items[0]!;
      const lastEl = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          <div className="absolute inset-0 bg-ink-950/65 backdrop-blur-sm" onClick={onClose} aria-hidden />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={cn("relative flex max-h-[92vh] w-full flex-col rounded-t-xl2 bg-surface shadow-pop outline-none sm:rounded-xl2", widths[size])}
          >
            <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div>
                <h2 id={titleId} className="font-display text-xl font-bold text-ink-900">{title}</h2>
                {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="rounded-field p-1.5 text-muted hover:bg-paper hover:text-ink-900">
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="overflow-y-auto px-5 py-4">{children}</div>
            {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line bg-paper/60 px-5 py-3 sm:rounded-b-xl2">{footer}</footer>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
  /** When set, the person must type this exact text before the button enables (used for irreversible actions). */
  requireText?: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
  /** Extra summary rows, e.g. the affected customer and licence. */
  details?: { label: string; value: ReactNode }[];
}

export function ConfirmDialog({ open, title, description, confirmLabel, tone = "danger", requireText, onConfirm, onClose, details }: ConfirmProps) {
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  useEffect(() => { if (!open) { setTyped(""); setBusy(false); } }, [open]);

  const run = async () => {
    setBusy(true);
    try { await onConfirm(); } finally { setBusy(false); }
  };

  return (
    <Modal
      open={open} onClose={busy ? () => undefined : onClose} title={title} size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={run} loading={busy} disabled={requireText ? typed !== requireText : false} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-ink-800">
        <p>{description}</p>
        {details && (
          <dl className="divide-y divide-line rounded-field border border-line">
            {details.map((d) => (
              <div key={d.label} className="flex justify-between gap-4 px-3 py-2">
                <dt className="text-muted">{d.label}</dt>
                <dd className="text-right font-medium">{d.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {requireText && (
          <Field label={`Type ${requireText} to confirm`}>{(p) => <input {...p} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />}</Field>
        )}
      </div>
    </Modal>
  );
}
