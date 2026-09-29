import type { BillingFrequency, InvoiceStatus, SubscriptionStatus } from "@/types";
import { addMonths, daysBetween } from "@/lib/dates";
import { round2 } from "@/lib/utils";

export const MONTHS_PER_CYCLE: Record<BillingFrequency, number> = { monthly: 1, quarterly: 3, annual: 12 };

export function advanceBillingDate(from: string, frequency: BillingFrequency): string {
  return addMonths(from, MONTHS_PER_CYCLE[frequency]);
}

/** Price per terminal is a monthly rate; longer cycles bill several months at once. */
export function cycleAmount(terminalLimit: number, pricePerTerminal: number, frequency: BillingFrequency): number {
  return round2(terminalLimit * pricePerTerminal * MONTHS_PER_CYCLE[frequency]);
}

export interface InvoiceFact {
  status: InvoiceStatus;
  dueDate: string;
}

const isUnpaid = (s: InvoiceStatus) => s === "PENDING" || s === "OVERDUE";

/**
 * Derives what a subscription's status should be from its invoices.
 *  - no invoices yet            → unchanged (a brand-new subscription stays PENDING until its first invoice is paid)
 *  - everything paid            → ACTIVE (this also lifts SUSPENDED / OVERDUE / GRACE after payment)
 *  - unpaid but not yet due     → PENDING
 *  - past due, inside grace     → OVERDUE (POS keeps working, shows a warning)
 *  - past due, beyond grace     → SUSPENDED
 * CANCELLED is terminal. GRACE is an admin-granted extension and is left alone until the invoices are settled.
 */
export function deriveSubscriptionStatus(input: {
  current: SubscriptionStatus;
  invoices: InvoiceFact[];
  graceDays: number;
  today: string;
}): SubscriptionStatus {
  const { current, invoices, graceDays, today } = input;
  if (current === "CANCELLED") return "CANCELLED";
  if (invoices.length === 0) return current;

  const unpaid = invoices.filter((i) => isUnpaid(i.status));
  if (unpaid.length === 0) return "ACTIVE";
  if (current === "GRACE") return "GRACE";

  const pastDue = unpaid.filter((i) => i.dueDate < today);
  if (pastDue.length === 0) return "PENDING";

  const oldest = pastDue.map((i) => i.dueDate).sort()[0] as string;
  return daysBetween(oldest, today) > graceDays ? "SUSPENDED" : "OVERDUE";
}

export function shouldMarkOverdue(invoice: InvoiceFact, today: string): boolean {
  return invoice.status === "PENDING" && invoice.dueDate < today;
}

export function isReminderDue(invoice: InvoiceFact, today: string, daysBefore: number): boolean {
  return invoice.status === "PENDING" && daysBetween(today, invoice.dueDate) === daysBefore;
}
