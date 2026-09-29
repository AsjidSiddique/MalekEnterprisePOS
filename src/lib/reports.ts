import type { Customer, Invoice, Payment, Subscription } from "@/types";
import { cycleAmount, MONTHS_PER_CYCLE } from "@/lib/billing/lifecycle";
import { daysBetween, todayISO } from "@/lib/dates";
import { monthKey, round2 } from "@/lib/utils";
import { lastMonths } from "./dashboard";

export interface ReportData { customers: Customer[]; subscriptions: Subscription[]; invoices: Invoice[]; payments: Payment[] }

export const AGEING_BUCKETS = ["Not yet due", "1 to 30 days late", "31 to 60 days late", "Over 60 days late"] as const;

/** Money owed, grouped by how late it is. Cancelled and paid invoices are excluded. */
export function receivablesAgeing(invoices: Invoice[], today: string = todayISO()) {
  const buckets = AGEING_BUCKETS.map((label) => ({ label, count: 0, amount: 0 }));
  for (const inv of invoices) {
    if (inv.status === "PAID" || inv.status === "CANCELLED") continue;
    const late = daysBetween(inv.dueDate, today);
    const b = buckets[late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : 3]!;
    b.count++;
    b.amount = round2(b.amount + inv.total);
  }
  return buckets;
}

export function buildReports(d: ReportData, today: string = todayISO()) {
  const live = d.subscriptions.filter((s) => s.status === "ACTIVE" || s.status === "GRACE");
  const mrr = round2(live.reduce((t, s) => t + cycleAmount(s.terminalLimit, s.pricePerTerminal, s.billingFrequency) / MONTHS_PER_CYCLE[s.billingFrequency], 0));
  const payingCustomers = new Set(live.map((s) => s.customerId)).size;
  const terminals = live.reduce((t, s) => t + s.terminalLimit, 0);

  const months = lastMonths(12, today);
  const paid = d.payments.filter((p) => p.status === "succeeded");
  const revenueByMonth = months.map((m) => ({ ...m, value: round2(paid.filter((p) => monthKey(p.paidAt ?? p.createdAt) === m.key).reduce((t, p) => t + p.amount, 0)) }));

  const name = new Map(d.customers.map((c) => [c.id, c.businessName]));
  const lifetime = new Map<string, number>();
  for (const p of paid) lifetime.set(p.customerId, round2((lifetime.get(p.customerId) ?? 0) + p.amount));
  const topCustomers = [...lifetime.entries()].map(([id, amount]) => ({ id, name: name.get(id) ?? "Unknown customer", amount })).sort((a, b) => b.amount - a.amount).slice(0, 8);

  const total = (rows: Invoice[]) => round2(rows.reduce((t, i) => t + i.total, 0));
  const collected = round2(paid.reduce((t, p) => t + p.amount, 0));
  const billed = total(d.invoices.filter((i) => i.status !== "CANCELLED"));

  return {
    mrr, arr: round2(mrr * 12), arpu: payingCustomers ? round2(mrr / payingCustomers) : 0, payingCustomers, terminals,
    perTerminal: terminals ? round2(mrr / terminals) : 0,
    revenueByMonth, topCustomers, ageing: receivablesAgeing(d.invoices, today),
    collectionRate: billed ? Math.round((collected / billed) * 100) : 100, billed, collected,
    atRisk: d.subscriptions.filter((s) => s.status === "OVERDUE" || s.status === "SUSPENDED").length,
    churned: d.subscriptions.filter((s) => s.status === "CANCELLED").length,
  };
}

export type Reports = ReturnType<typeof buildReports>;
