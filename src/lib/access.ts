import type { Customer, License, LicenseState, Subscription, SubscriptionStatus, Terminal, TerminalStatus } from "@/types";
import { computeLicenseState } from "@/lib/licensing/rules";
import { daysBetween, todayISO } from "@/lib/dates";

export interface AccessTerminal { terminal: Terminal; status: TerminalStatus }

export interface AccessRow {
  customer: Customer;
  subscriptionStatus: SubscriptionStatus | null;
  license: License | null;
  licenseState: LicenseState | null;
  /** Negative once past expiry. Null when there's no licence to expire. */
  daysToExpiry: number | null;
  terminals: AccessTerminal[];
  activeTerminals: number;
  /** True once every reachable control (licence, all terminals) is already blocked. */
  fullyBlocked: boolean;
  /** True when nothing is blocked: an operational (or absent) licence and no disabled/revoked terminals. */
  fullyAllowed: boolean;
  /** Sort key: expired/expiring soonest first, then blocked accounts, then everyone else. */
  urgency: number;
}

const URGENCY = { expired: 0, expiringSoon: 1, blocked: 2, normal: 3 } as const;

export function buildAccessRows(
  data: { customers: Customer[]; subscriptions: Subscription[]; licenses: License[]; terminals: Terminal[] },
  today: string = todayISO(),
  expiringWithinDays = 14,
): AccessRow[] {
  const subByCustomer = new Map(data.subscriptions.filter((s) => s.status !== "CANCELLED").map((s) => [s.customerId, s]));
  const licensesByCustomer = new Map<string, License[]>();
  for (const l of data.licenses) licensesByCustomer.set(l.customerId, [...(licensesByCustomer.get(l.customerId) ?? []), l]);
  const terminalsByCustomer = new Map<string, Terminal[]>();
  for (const t of data.terminals) terminalsByCustomer.set(t.customerId, [...(terminalsByCustomer.get(t.customerId) ?? []), t]);

  return data.customers.map((customer) => {
    const subscription = subByCustomer.get(customer.id);
    const license = (licensesByCustomer.get(customer.id) ?? []).find((l) => !l.revoked) ?? licensesByCustomer.get(customer.id)?.[0] ?? null;
    const licenseState = license ? computeLicenseState(license, subscription?.status ?? null, today) : null;
    const daysToExpiry = license ? daysBetween(today, license.expiryDate) : null;
    const terminals = (terminalsByCustomer.get(customer.id) ?? []).map((terminal) => ({ terminal, status: terminal.status }));
    const activeTerminals = terminals.filter((t) => t.status === "ACTIVE").length;

    const licenseBlocked = license ? licenseState === "REVOKED" || licenseState === "SUSPENDED" : false;
    const anyTerminalBlockable = terminals.length > 0;
    const allTerminalsBlocked = anyTerminalBlockable && terminals.every((t) => t.status !== "ACTIVE");
    const fullyBlocked = (license ? licenseBlocked : true) && (anyTerminalBlockable ? allTerminalsBlocked : true) && (Boolean(license) || anyTerminalBlockable);
    const fullyAllowed = (!license || licenseState === "ACTIVE" || licenseState === "GRACE") && terminals.every((t) => t.status === "ACTIVE");

    let urgency: number = URGENCY.normal;
    if (licenseState === "EXPIRED" || (daysToExpiry !== null && daysToExpiry < 0)) urgency = URGENCY.expired;
    else if (daysToExpiry !== null && daysToExpiry <= expiringWithinDays) urgency = URGENCY.expiringSoon;
    else if (licenseBlocked || allTerminalsBlocked) urgency = URGENCY.blocked;

    return { customer, subscriptionStatus: subscription?.status ?? null, license, licenseState, daysToExpiry, terminals, activeTerminals, fullyBlocked, fullyAllowed, urgency };
  }).sort((a, b) => a.urgency - b.urgency || (a.daysToExpiry ?? 9999) - (b.daysToExpiry ?? 9999) || a.customer.businessName.localeCompare(b.customer.businessName));
}

export function expiryLabel(days: number | null): { text: string; tone: "bad" | "warn" | "ok" | "neutral" } {
  if (days === null) return { text: "No licence", tone: "neutral" };
  if (days < 0) return { text: `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`, tone: "bad" };
  if (days === 0) return { text: "Expires today", tone: "bad" };
  if (days <= 14) return { text: `Expires in ${days} day${days === 1 ? "" : "s"}`, tone: "warn" };
  return { text: `Expires in ${days} days`, tone: "ok" };
}
