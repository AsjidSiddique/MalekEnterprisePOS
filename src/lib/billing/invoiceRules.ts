import type { InvoiceLine, InvoiceStatus } from "@/types";
import { round2 } from "@/lib/utils";

export function calcTotals(lines: InvoiceLine[], vatRate: number) {
  const subtotal = round2(lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0));
  const vatAmount = round2(subtotal * vatRate);
  return { subtotal, vatAmount, total: round2(subtotal + vatAmount) };
}

export interface TransitionResult {
  ok: boolean;
  /** The UI must get an explicit confirmation before this transition is applied. */
  requiresConfirmation: boolean;
  reason?: string;
}

type Rule = { confirm: boolean };
const ALLOWED: Record<InvoiceStatus, Partial<Record<InvoiceStatus, Rule>>> = {
  PENDING: { PAID: { confirm: false }, OVERDUE: { confirm: false }, CANCELLED: { confirm: true } },
  OVERDUE: { PAID: { confirm: false }, PENDING: { confirm: false }, CANCELLED: { confirm: true } },
  PAID: { PENDING: { confirm: true } },
  CANCELLED: { PAID: { confirm: true }, PENDING: { confirm: true } },
};

/** Which status changes are allowed, and which ones need an explicit "are you sure". */
export function checkTransition(from: InvoiceStatus, to: InvoiceStatus): TransitionResult {
  if (from === to) return { ok: false, requiresConfirmation: false, reason: `Invoice is already ${to.toLowerCase()}.` };
  const rule = ALLOWED[from][to];
  if (!rule) {
    return { ok: false, requiresConfirmation: false, reason: `An invoice cannot move from ${from} to ${to}.` };
  }
  return { ok: true, requiresConfirmation: rule.confirm };
}

export function invoiceNumber(prefix: string, issueDate: string, sequence: number): string {
  const ym = issueDate.slice(0, 7).replace("-", "");
  return `${prefix}-${ym}-${String(sequence).padStart(4, "0")}`;
}
