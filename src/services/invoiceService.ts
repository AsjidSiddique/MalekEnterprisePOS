import { doc, runTransaction, serverTimestamp, writeBatch } from "firebase/firestore";
import type { AdminActor, AppSettings, Invoice, InvoiceStatus } from "@/types";
import type { InvoiceInput, MarkPaidInput } from "@/lib/validation/schemas";
import { mapInvoice, mapPayment } from "@/lib/mappers";
import { calcTotals, checkTransition, invoiceNumber } from "@/lib/billing/invoiceRules";
import { getDb } from "@/lib/firebase/client";
import { auditEntry } from "./auditService";
import { col, docRef, getOne, listDocs, newestFirst, whereEq, commitBatch } from "./base";
import { syncSubscriptionStatus } from "./subscriptionService";

export const listInvoices = (): Promise<Invoice[]> => listDocs("invoices", mapInvoice, ...newestFirst());
export const getInvoice = (id: string): Promise<Invoice | null> => getOne("invoices", id, mapInvoice);
export const listInvoicesForCustomer = (customerId: string): Promise<Invoice[]> =>
  listDocs("invoices", mapInvoice, whereEq("customerId", customerId));

/** Invoice numbers come from a per-month counter updated inside the same transaction that creates the invoice. */
export async function createInvoice(actor: AdminActor, input: InvoiceInput, settings: AppSettings): Promise<string> {
  const db = getDb();
  const invoiceRef = doc(col("invoices"));
  const counterRef = docRef("settings", "counters");
  const monthKey = input.issueDate.slice(0, 7).replace("-", "");
  const totals = calcTotals(input.lines, settings.billing.vatRate);

  await runTransaction(db, async (tx) => {
    const counters = await tx.get(counterRef);
    const field = `invoice_${monthKey}`;
    const seq = ((counters.data()?.[field] as number | undefined) ?? 0) + 1;
    tx.set(counterRef, { [field]: seq, updatedAt: serverTimestamp() }, { merge: true });
    const number = invoiceNumber(settings.billing.invoicePrefix, input.issueDate, seq);
    tx.set(invoiceRef, {
      number, customerId: input.customerId, subscriptionId: input.subscriptionId, issueDate: input.issueDate, dueDate: input.dueDate,
      status: "PENDING", lines: input.lines, ...totals, vatRate: settings.billing.vatRate, currency: "ZAR",
      paidAt: null, paidBy: null, paymentMethod: null, paymentNote: "", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    tx.set(doc(col("auditLogs")), auditEntry(actor, {
      action: "invoice.created", targetType: "customer", targetId: input.customerId, targetLabel: number, metadata: { invoiceId: invoiceRef.id, total: totals.total },
    }));
  });
  await syncSubscriptionStatus(actor, input.subscriptionId);
  return invoiceRef.id;
}

export interface StatusChangeOptions {
  /** Set when the admin has explicitly confirmed a transition that requires it. */
  confirmed?: boolean;
}

/** Marks an invoice paid and records the payment + audit entry atomically. */
export async function markInvoicePaid(actor: AdminActor, invoice: Invoice, input: MarkPaidInput, opts: StatusChangeOptions = {}): Promise<void> {
  const rule = checkTransition(invoice.status, "PAID");
  if (!rule.ok) throw new Error(rule.reason);
  if (rule.requiresConfirmation && !opts.confirmed) throw new Error("Confirm that you want to pay a cancelled invoice.");

  const batch = writeBatch(getDb());
  const paymentRef = doc(col("payments"));
  batch.update(docRef("invoices", invoice.id), {
    status: "PAID", paidAt: serverTimestamp(), paidBy: actor.email, paymentMethod: input.method, paymentNote: input.note, updatedAt: serverTimestamp(),
  });
  batch.set(paymentRef, {
    invoiceId: invoice.id, customerId: invoice.customerId, amount: invoice.total, currency: "ZAR", method: input.method, status: "succeeded",
    provider: "manual", reference: invoice.number, recordedBy: actor.email, note: input.note, paidAt: serverTimestamp(),
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  batch.set(doc(col("auditLogs")), auditEntry(actor, {
    action: "invoice.marked_paid", targetType: "customer", targetId: invoice.customerId, targetLabel: invoice.number,
    metadata: { invoiceId: invoice.id, method: input.method, note: input.note, amount: invoice.total, previousStatus: invoice.status },
  }));
  await commitBatch(batch);
  await syncSubscriptionStatus(actor, invoice.subscriptionId);
}

/** PENDING / OVERDUE / CANCELLED changes. (Use markInvoicePaid for PAID.) */
export async function setInvoiceStatus(
  actor: AdminActor, invoice: Invoice, to: Exclude<InvoiceStatus, "PAID">, opts: StatusChangeOptions = {},
): Promise<void> {
  const rule = checkTransition(invoice.status, to);
  if (!rule.ok) throw new Error(rule.reason);
  if (rule.requiresConfirmation && !opts.confirmed) throw new Error("This change needs confirmation.");

  const batch = writeBatch(getDb());
  batch.update(docRef("invoices", invoice.id), {
    status: to, updatedAt: serverTimestamp(),
    ...(invoice.status === "PAID" ? { paidAt: null, paidBy: null, paymentMethod: null } : {}),
  });
  if (invoice.status === "PAID") {
    // Un-paying an invoice: keep the payment history but flag those payments as refunded.
    const payments = await listDocs("payments", mapPayment, whereEq("invoiceId", invoice.id));
    payments.filter((p) => p.status === "succeeded").forEach((p) => batch.update(docRef("payments", p.id), { status: "refunded", updatedAt: serverTimestamp() }));
  }
  batch.set(doc(col("auditLogs")), auditEntry(actor, {
    action: "invoice.status_changed", targetType: "customer", targetId: invoice.customerId, targetLabel: invoice.number,
    metadata: { invoiceId: invoice.id, from: invoice.status, to },
  }));
  await commitBatch(batch);
  await syncSubscriptionStatus(actor, invoice.subscriptionId);
}
