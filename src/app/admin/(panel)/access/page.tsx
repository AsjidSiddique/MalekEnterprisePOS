"use client";

import { ChevronDown, KeyRound, Lock, LockOpen, Monitor, Search, ShieldBan, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useActor } from "@/components/admin/AuthProvider";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useAsyncData } from "@/hooks/useAsyncData";
import { type AccessRow, buildAccessRows, expiryLabel } from "@/lib/access";
import { todayISO } from "@/lib/dates";
import { cn, errorMessage, formatDateTime } from "@/lib/utils";
import { listCustomers } from "@/services/customerService";
import { runLicenseCommand } from "@/services/licenseService";
import { listLicenses } from "@/services/licenseService";
import { listSubscriptions } from "@/services/subscriptionService";
import { listTerminals, setTerminalStatus } from "@/services/terminalService";

type Filter = "all" | "blocked" | "expiring" | "allowed";
type Confirm = { kind: "block" | "allow"; row: AccessRow };

const TONE_DOT: Record<string, string> = { bad: "bg-bad", warn: "bg-warn", ok: "bg-ok", neutral: "bg-ink-300" };

export default function AccessControlPage() {
  const actor = useActor();
  const toast = useToast();
  const { data, loading, error, reload } = useAsyncData(async () => {
    const [customers, subscriptions, licenses, terminals] = await Promise.all([listCustomers(), listSubscriptions(), listLicenses(), listTerminals()]);
    return { customers, subscriptions, licenses, terminals };
  }, []);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const rows = useMemo(() => (data ? buildAccessRows(data, todayISO()) : []), [data]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !`${r.customer.businessName} ${r.customer.name} ${r.license?.tokenPrefix ?? ""}`.toLowerCase().includes(q)) return false;
      if (filter === "blocked") return r.fullyBlocked || (r.license && (r.licenseState === "REVOKED" || r.licenseState === "SUSPENDED"));
      if (filter === "expiring") return r.daysToExpiry !== null && r.daysToExpiry <= 14;
      if (filter === "allowed") return r.fullyAllowed;
      return true;
    });
  }, [rows, query, filter]);

  const counts = { blocked: rows.filter((r) => r.fullyBlocked || (r.license && (r.licenseState === "REVOKED" || r.licenseState === "SUSPENDED"))).length, expiring: rows.filter((r) => r.daysToExpiry !== null && r.daysToExpiry <= 14).length };

  const toggle = (id: string) => setExpanded((set) => { const next = new Set(set); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const setTerminal = async (row: AccessRow, terminalId: string, status: "ACTIVE" | "DISABLED") => {
    const t = row.terminals.find((x) => x.terminal.id === terminalId)?.terminal;
    if (!t) return;
    try { await setTerminalStatus(actor, t, status); toast.success(`${t.deviceName} ${status === "ACTIVE" ? "allowed" : "blocked"}.`); reload(); }
    catch (e) { toast.error(errorMessage(e)); }
  };

  const applyBulk = async (row: AccessRow, kind: "block" | "allow") => {
    setBusyId(row.customer.id);
    try {
      if (row.license) await runLicenseCommand(kind === "block" ? { action: "revoke", licenseId: row.license.id } : { action: "reactivate", licenseId: row.license.id });
      for (const t of row.terminals) {
        if (kind === "block" && t.status === "ACTIVE") await setTerminalStatus(actor, t.terminal, "DISABLED");
        if (kind === "allow" && t.status !== "ACTIVE") await setTerminalStatus(actor, t.terminal, "ACTIVE");
      }
      toast.success(`${row.customer.businessName}: access ${kind === "block" ? "blocked" : "allowed"} everywhere.`);
      reload();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusyId(null); setConfirm(null); }
  };

  const header = (
    <PageHeader title="Access control" eyebrow={<span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" aria-hidden />Licences and terminals in one place</span>}
      description="Every customer's licence expiry and terminals, with one place to block or allow all of it." />
  );

  if (error) return <>{header}<ErrorState title="Couldn't load access control" error={error} onRetry={reload} /></>;
  if (loading && !data) return <>{header}<TableSkeleton /></>;
  if (!data) return null;

  const chip = (id: Filter, label: string, count?: number) => (
    <button type="button" onClick={() => setFilter(id)} aria-pressed={filter === id}
      className={cn("inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition", filter === id ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200/70")}>
      {label}{count !== undefined && <span className={cn("rounded-full px-1.5 text-xs", filter === id ? "bg-white/20" : "bg-white text-ink-700")}>{count}</span>}
    </button>
  );

  return (
    <>
      {header}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {chip("all", "All", rows.length)}
        {chip("blocked", "Blocked", counts.blocked)}
        {chip("expiring", "Expiring soon", counts.expiring)}
        {chip("allowed", "Fully allowed")}
        <div className="relative ml-auto w-full sm:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden /><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customers or licence key" aria-label="Search customers or licence key" className="field pl-9" /></div>
      </div>

      {visible.length === 0 ? (
        <div className="panel rounded-xl3"><EmptyState icon={ShieldCheck} title="Nothing here" description="No customers match this filter." /></div>
      ) : (
        <ul className="space-y-3">
          {visible.map((row) => {
            const exp = expiryLabel(row.daysToExpiry);
            const open = expanded.has(row.customer.id);
            const busy = busyId === row.customer.id;
            return (
              <li key={row.customer.id} className={cn("overflow-hidden rounded-xl2 border bg-surface shadow-card transition", row.fullyBlocked ? "border-bad/30" : row.urgency <= 1 ? "border-warn/40" : "border-line")}>
                <div className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
                  <button type="button" onClick={() => toggle(row.customer.id)} aria-expanded={open} aria-label={`${open ? "Collapse" : "Expand"} ${row.customer.businessName}`} className="rounded-lg p-1.5 text-ink-500 hover:bg-paper">
                    <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden />
                  </button>
                  <Avatar name={row.customer.businessName} size="md" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/customers/${row.customer.id}`} className="font-semibold text-ink-900 hover:underline">{row.customer.businessName}</Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                      {row.subscriptionStatus && <span className="inline-flex items-center gap-1"><StatusBadge status={row.subscriptionStatus} /></span>}
                      {row.license ? <span className="inline-flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" aria-hidden />{row.license.tokenPrefix}, <StatusBadge status={row.licenseState!} /></span> : <span>No licence issued</span>}
                      <span className="inline-flex items-center gap-1.5"><Monitor className="h-3.5 w-3.5" aria-hidden />{row.activeTerminals} of {row.terminals.length} tills active</span>
                    </div>
                  </div>
                  <span className={cn("hidden shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold sm:flex",
                    exp.tone === "bad" ? "bg-bad/10 text-bad" : exp.tone === "warn" ? "bg-warn/15 text-[#8A5200]" : exp.tone === "ok" ? "bg-ok/10 text-[#0B6B45]" : "bg-ink-100 text-muted")}>
                    <span className={cn("h-2 w-2 rounded-full", TONE_DOT[exp.tone])} aria-hidden />{exp.text}
                  </span>
                  <div className="flex shrink-0 gap-2">
                    {row.fullyBlocked ? (
                      <Button size="sm" variant="primary" loading={busy} onClick={() => setConfirm({ kind: "allow", row })}><LockOpen className="h-4 w-4" aria-hidden />Allow access</Button>
                    ) : (
                      <Button size="sm" variant="danger" loading={busy} onClick={() => setConfirm({ kind: "block", row })}><Lock className="h-4 w-4" aria-hidden />Block access</Button>
                    )}
                  </div>
                </div>
                <span className="block px-4 pb-3 text-xs text-muted sm:hidden">{exp.text}</span>

                {open && (
                  <div className="border-t border-line bg-paper/60 px-4 py-4 sm:px-5">
                    {row.license && (
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface p-3.5 ring-1 ring-line">
                        <div className="text-sm"><p className="font-semibold">Licence {row.license.tokenPrefix}</p><p className="text-xs text-muted">Issued {formatDateTime(row.license.issueDate)}, last checked in {formatDateTime(row.license.lastVerifiedAt)}</p></div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => runLicenseCommand({ action: "extend", licenseId: row.license!.id, expiryDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10) }).then(() => { toast.success("Extended by 30 days."); reload(); }).catch((e) => toast.error(errorMessage(e)))}>+30 days</Button>
                          <Link href="/admin/licenses" className="text-sm font-medium text-ink-700 underline underline-offset-4 hover:text-ink-900">Manage in Licences</Link>
                        </div>
                      </div>
                    )}
                    {row.terminals.length === 0 ? <p className="text-sm text-muted">No terminals have registered yet.</p> : (
                      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                        {row.terminals.map(({ terminal, status }) => (
                          <li key={terminal.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                            <span className="min-w-0 flex-1"><span className="block font-medium">{terminal.deviceName}</span><span className="block text-xs text-muted">{terminal.shopName || "No shop set"}, last seen {formatDateTime(terminal.lastSeenAt)}</span></span>
                            <StatusBadge status={status} />
                            {status === "ACTIVE" ? (
                              <Button size="sm" variant="ghost" className="text-[#A22B3B]" onClick={() => setTerminal(row, terminal.id, "DISABLED")}><ShieldBan className="h-3.5 w-3.5" aria-hidden />Block</Button>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => setTerminal(row, terminal.id, "ACTIVE")}><ShieldCheck className="h-3.5 w-3.5" aria-hidden />Allow</Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(confirm)} tone={confirm?.kind === "block" ? "danger" : "primary"}
        title={confirm?.kind === "block" ? "Block all access for this customer?" : "Allow access for this customer?"}
        confirmLabel={confirm?.kind === "block" ? "Block access" : "Allow access"}
        description={confirm?.kind === "block"
          ? "Revokes the licence and blocks every active till. Their system stops working at the next check-in. You can restore it at any time."
          : "Reactivates the licence and every blocked till, provided the subscription is in good standing."}
        details={confirm ? [{ label: "Customer", value: confirm.row.customer.businessName }, { label: "Licence", value: confirm.row.license?.tokenPrefix ?? "None" }, { label: "Terminals affected", value: String(confirm.row.terminals.length) }] : []}
        onClose={() => setConfirm(null)} onConfirm={async () => { if (confirm) await applyBulk(confirm.row, confirm.kind); }}
      />
    </>
  );
}
