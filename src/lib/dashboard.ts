import type { AuditLog, Customer, DownloadStats, Inquiry, Invoice, License, Payment, Release, Subscription, SubscriptionStatus, Terminal } from "@/types";
import { cycleAmount, MONTHS_PER_CYCLE } from "@/lib/billing/lifecycle";
import { computeLicenseState, isOperational } from "@/lib/licensing/rules";
import { pickLatest } from "@/lib/releases/rules";
import { daysBetween, todayISO } from "@/lib/dates";
import { monthKey, round2 } from "@/lib/utils";

export interface DashboardData {
  customers: Customer[];
  subscriptions: Subscription[];
  invoices: Invoice[];
  payments: Payment[];
  licenses: License[];
  terminals: Terminal[];
  releases: Release[];
  auditLogs?: AuditLog[];
  inquiries?: Inquiry[];
  downloads?: DownloadStats[];
}

export interface MonthPoint { month: string; label: string; value: number }

export function lastMonths(count: number, today: string): { key: string; label: string }[] {
  const [y = 1970, m = 1] = today.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(y, m - 1 - (count - 1 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { key, label: d.toLocaleDateString("en-ZA", { month: "short" }) };
  });
}

export function lastDays(count: number, today: string): string[] {
  const [y = 1970, m = 1, day = 1] = today.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const dt = new Date(y, m - 1, day - (count - 1 - i));
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  });
}

const series = (months: { key: string; label: string }[], values: (key: string) => number): MonthPoint[] =>
  months.map((m) => ({ month: m.key, label: m.label, value: values(m.key) }));

export function buildDashboard(d: DashboardData, today: string = todayISO()) {
  const months = lastMonths(6, today);
  const subById = new Map(d.subscriptions.map((s) => [s.id, s]));
  const pending = d.invoices.filter((i) => i.status === "PENDING");
  const overdue = d.invoices.filter((i) => i.status === "OVERDUE");
  const sum = (rows: { total: number }[]) => round2(rows.reduce((t, r) => t + r.total, 0));

  const statuses: SubscriptionStatus[] = ["ACTIVE", "PENDING", "OVERDUE", "GRACE", "SUSPENDED", "CANCELLED"];

  const thisMonth = months[months.length - 1]!.key;
  const lastMonth = months[months.length - 2]!.key;
  const paidIn = (k: string) => round2(d.payments.filter((p) => p.status === "succeeded" && monthKey(p.paidAt ?? p.createdAt) === k).reduce((t, p) => t + p.amount, 0));
  const revenueThisMonth = paidIn(thisMonth);
  const revenueLastMonth = paidIn(lastMonth);
  const custName = new Map(d.customers.map((c) => [c.id, c.businessName]));

  const mrr = round2(d.subscriptions.filter((s) => s.status === "ACTIVE" || s.status === "GRACE").reduce((t, s) => t + cycleAmount(s.terminalLimit, s.pricePerTerminal, s.billingFrequency) / MONTHS_PER_CYCLE[s.billingFrequency], 0));

  const expiringLicences = d.licenses
    .filter((l) => !l.revoked && l.status !== "REVOKED")
    .map((l) => ({ license: l, daysLeft: daysBetween(today, l.expiryDate), customer: custName.get(l.customerId) ?? "Unknown customer" }))
    .filter((x) => x.daysLeft >= 0 && x.daysLeft <= 14)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const cutoff = Date.now() - 7 * 86_400_000;
  const downloads30 = lastDays(30, today).map((day) => ({ day, value: (d.downloads ?? []).reduce((t, x) => t + (x.days[day] ?? 0), 0) }));

  return {
    mrr, revenueThisMonth, revenueLastMonth,
    outstanding: sum([...pending, ...overdue]),
    attention: {
      overdue: [...overdue].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5).map((i) => ({ invoice: i, customer: custName.get(i.customerId) ?? "Unknown customer", daysLate: Math.max(daysBetween(i.dueDate, today), 0) })),
      expiringLicences: expiringLicences.slice(0, 5),
      newInquiries: (d.inquiries ?? []).filter((q) => q.createdAt && Date.parse(q.createdAt) > cutoff).length,
      draftReleases: d.releases.filter((r) => r.status === "draft").length,
      suspended: d.subscriptions.filter((s) => s.status === "SUSPENDED").length,
    },
    recent: (d.auditLogs ?? []).slice(0, 8),
    downloads30,
    downloadsTotal30: downloads30.reduce((t, x) => t + x.value, 0),
    cards: {
      totalCustomers: d.customers.length,
      activeSubscriptions: d.subscriptions.filter((s) => s.status === "ACTIVE").length,
      pendingPayments: { count: pending.length, amount: sum(pending) },
      overdueInvoices: { count: overdue.length, amount: sum(overdue) },
      activeLicenses: d.licenses.filter((l) => isOperational(computeLicenseState(l, subById.get(l.subscriptionId ?? "")?.status ?? null, today))).length,
      registeredTerminals: d.terminals.filter((t) => t.status === "ACTIVE").length,
      latestVersion: pickLatest(d.releases)?.version ?? null,
    },
    revenue: series(months, (k) =>
      round2(d.payments.filter((p) => p.status === "succeeded" && monthKey(p.paidAt ?? p.createdAt) === k).reduce((t, p) => t + p.amount, 0))),
    newCustomers: series(months, (k) => d.customers.filter((c) => monthKey(c.createdAt) === k).length),
    licenseActivity: series(months, (k) => d.licenses.filter((l) => monthKey(l.issueDate) === k).length),
    subscriptionsByStatus: statuses.map((s) => ({ status: s, value: d.subscriptions.filter((x) => x.status === s).length })),
  };
}

export type DashboardStats = ReturnType<typeof buildDashboard>;
