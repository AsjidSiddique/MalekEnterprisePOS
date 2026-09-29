import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import type { AdminActor, Invoice, Subscription } from "@/types";
import type { SubscriptionInput } from "@/lib/validation/schemas";
import { mapInvoice, mapSubscription } from "@/lib/mappers";
import { deriveSubscriptionStatus } from "@/lib/billing/lifecycle";
import { todayISO } from "@/lib/dates";
import { getDb } from "@/lib/firebase/client";
import { auditEntry } from "./auditService";
import { col, docRef, getOne, listDocs, newestFirst, whereEq, commitBatch } from "./base";

export const listSubscriptions = (): Promise<Subscription[]> => listDocs("subscriptions", mapSubscription, ...newestFirst());
export const getSubscription = (id: string): Promise<Subscription | null> => getOne("subscriptions", id, mapSubscription);
export const listSubscriptionsForCustomer = (customerId: string): Promise<Subscription[]> =>
  listDocs("subscriptions", mapSubscription, whereEq("customerId", customerId));

export async function createSubscription(actor: AdminActor, input: SubscriptionInput): Promise<string> {
  const existing = await listSubscriptionsForCustomer(input.customerId);
  if (existing.some((s) => s.status !== "CANCELLED")) {
    throw new Error("This customer already has a subscription. Edit it, or cancel it before creating a new one.");
  }
  const batch = writeBatch(getDb());
  const ref = doc(col("subscriptions"));
  batch.set(ref, { ...input, currency: "ZAR", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.update(docRef("customers", input.customerId), {
    plan: input.plan, terminals: input.terminalLimit, pricePerTerminal: input.pricePerTerminal, subscriptionStatus: input.status, updatedAt: serverTimestamp(),
  });
  batch.set(doc(col("auditLogs")), auditEntry(actor, { action: "subscription.created", targetType: "customer", targetId: input.customerId, targetLabel: input.plan, metadata: { subscriptionId: ref.id } }));
  await commitBatch(batch);
  return ref.id;
}

export async function updateSubscription(actor: AdminActor, id: string, input: SubscriptionInput): Promise<void> {
  const batch = writeBatch(getDb());
  batch.update(docRef("subscriptions", id), { ...input, updatedAt: serverTimestamp() });
  batch.update(docRef("customers", input.customerId), {
    plan: input.plan, terminals: input.terminalLimit, pricePerTerminal: input.pricePerTerminal, subscriptionStatus: input.status, updatedAt: serverTimestamp(),
  });
  batch.set(doc(col("auditLogs")), auditEntry(actor, { action: "subscription.updated", targetType: "customer", targetId: input.customerId, targetLabel: input.plan, metadata: { subscriptionId: id, status: input.status } }));
  await commitBatch(batch);
}

/**
 * Re-derives a subscription's status from its invoices (see deriveSubscriptionStatus) and saves it if it changed.
 * Called after every invoice change so paying an overdue invoice lifts a suspension straight away.
 */
export async function syncSubscriptionStatus(actor: AdminActor, subscriptionId: string | null): Promise<void> {
  if (!subscriptionId) return;
  const sub = await getSubscription(subscriptionId);
  if (!sub) return;
  const invoices: Invoice[] = await listDocs("invoices", mapInvoice, whereEq("subscriptionId", subscriptionId));
  const next = deriveSubscriptionStatus({ current: sub.status, invoices, graceDays: sub.gracePeriodDays, today: todayISO() });
  if (next === sub.status) return;
  const batch = writeBatch(getDb());
  batch.update(docRef("subscriptions", sub.id), { status: next, updatedAt: serverTimestamp() });
  batch.update(docRef("customers", sub.customerId), { subscriptionStatus: next, updatedAt: serverTimestamp() });
  batch.set(doc(col("auditLogs")), auditEntry(actor, {
    action: "subscription.status_synced", targetType: "customer", targetId: sub.customerId, targetLabel: sub.plan, metadata: { from: sub.status, to: next },
  }));
  await commitBatch(batch);
}
