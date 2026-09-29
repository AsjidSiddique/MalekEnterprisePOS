"use client";

import { CornerDownLeft, FileText, KeyRound, LayoutDashboard, Plus, Rocket, Search, Users, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { listCustomers } from "@/services/customerService";
import { listInvoices } from "@/services/invoiceService";
import { listLicenses } from "@/services/licenseService";
import { listReleases } from "@/services/releaseService";
import { ADMIN_NAV } from "./nav";

interface Result { id: string; group: string; label: string; hint?: string; href: string; icon: LucideIcon }

/** Ctrl/⌘ + K: jump to any page, customer, invoice, licence or release. Data loads the first time it's opened. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [records, setRecords] = useState<Result[]>([]);
  const loaded = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery(""); setIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 30);
    if (loaded.current) return;
    loaded.current = true;
    Promise.all([listCustomers(), listInvoices(), listLicenses(), listReleases()]).then(([customers, invoices, licenses, releases]) => {
      const name = new Map(customers.map((c) => [c.id, c.businessName]));
      setRecords([
        ...customers.map((c): Result => ({ id: `c${c.id}`, group: "Customers", label: c.businessName, hint: `${c.name}, ${c.email}`, href: `/admin/customers/${c.id}`, icon: Users })),
        ...invoices.map((i): Result => ({ id: `i${i.id}`, group: "Invoices", label: i.number, hint: name.get(i.customerId) ?? "", href: `/admin/invoices/${i.id}`, icon: FileText })),
        ...licenses.map((l): Result => ({ id: `l${l.id}`, group: "Licences", label: `${l.tokenPrefix}…`, hint: name.get(l.customerId) ?? "", href: "/admin/licenses", icon: KeyRound })),
        ...releases.map((r): Result => ({ id: `r${r.id}`, group: "Releases", label: `v${r.version}`, hint: r.title, href: "/admin/releases", icon: Rocket })),
      ]);
    }).catch(() => { loaded.current = false; });
  }, [open]);

  const actions = useMemo<Result[]>(() => [
    { id: "a-c", group: "Actions", label: "New customer", href: "/admin/customers?new=1", icon: Plus },
    { id: "a-i", group: "Actions", label: "New invoice", href: "/admin/invoices?new=1", icon: Plus },
    { id: "a-r", group: "Actions", label: "New release", href: "/admin/releases?new=1", icon: Plus },
  ], []);

  const pages = useMemo<Result[]>(() => ADMIN_NAV.flatMap((g) => g.items).map((n) => ({ id: n.href, group: "Pages", label: n.label, href: n.href, icon: n.icon ?? LayoutDashboard })), []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...actions, ...pages.slice(0, 7)];
    const hit = (r: Result) => `${r.label} ${r.hint ?? ""}`.toLowerCase().includes(q);
    return [...actions.filter(hit), ...pages.filter(hit), ...records.filter(hit)].slice(0, 12);
  }, [query, actions, pages, records]);

  useEffect(() => setIndex(0), [query]);

  const go = (r: Result | undefined) => { if (!r) return; onClose(); router.push(r.href); };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search">
      <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-xl overflow-hidden rounded-xl2 bg-surface shadow-pop ring-1 ring-line animate-rise"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(i + 1, results.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
          if (e.key === "Enter") go(results[index]);
        }}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 text-ink-400" aria-hidden />
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customers, invoices, licences, releases, pages" aria-label="Search" className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-400" />
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-muted">Esc</kbd>
        </div>
        <ul className="scroll-slim max-h-[52vh] overflow-y-auto p-2" role="listbox">
          {results.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted">Nothing found for &ldquo;{query}&rdquo;.</li>}
          {results.map((r, i) => {
            const Icon = r.icon;
            return (
              <li key={r.id} role="option" aria-selected={i === index}>
                {(i === 0 || results[i - 1]?.group !== r.group) && <p className="px-3 pb-1 pt-3 text-xs font-semibold text-muted">{r.group}</p>}
                <button type="button" onMouseEnter={() => setIndex(i)} onClick={() => go(r)}
                  className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left", i === index ? "bg-ink-900 text-white" : "hover:bg-paper")}>
                  <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", i === index ? "bg-white/15 text-accent" : "bg-ink-100 text-ink-700")}><Icon className="h-4 w-4" aria-hidden /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{r.label}</span>{r.hint && <span className={cn("block truncate text-xs", i === index ? "text-ink-300" : "text-muted")}>{r.hint}</span>}</span>
                  {i === index && <CornerDownLeft className="h-4 w-4 text-ink-300" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
