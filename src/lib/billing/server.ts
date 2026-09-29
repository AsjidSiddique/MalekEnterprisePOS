import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { AppSettings, Customer, Subscription } from "@/types";
import { mapCustomer, mapInvoice, mapLicense, mapSettings, mapSubscription, type Data } from "@/lib/mappers";
import { daysBetween, todayISO } from "@/lib/dates";
import { serverAuditEntry } from "@/lib/firebase/serverAudit";
import { renewedExpiry } from "@/lib/licensing/rules";
import { deliverNotification, queueOnce } from "@/lib/notifications/server";
import { emailConfigured } from "@/lib/notifications/email";
import type { BillingSummary } from "./server-types";
import { calcTotals, invoiceNumber } from "./invoiceRules";
import { advanceBillingDate, deriveSubscriptionStatus, isReminderDue, MONTHS_PER_CYCLE, shouldMarkOverdue } from "./lifecycle";
import { formatZAR } from "@/lib/utils";

/** Re-derives a subscription's status from its invoices and saves it when it changed. Returns the new status if so. */
export async function reconcileSubscription(db: Firestore, sub: Subscription, today: string) {
  const snap = await db.collection("invoices").where("subscriptionId", "==", sub.id).get();
  const invoices = snap.docs.map((d) => mapInvoice(d.id, d.data() as Data));
  const next = deriveSubscriptionStatus({ current: sub.status, invoices, graceDays: sub.gracePeriodDays, today });
  if (next === sub.status) return null;
  const batch = db.batch();
  batch.update(db.collection("subscriptions").doc(sub.id), { status: next, updatedAt: FieldValue.serverTimestamp() });
  batch.update(db.collection("customers").doc(sub.customerId), { subscriptionStatus: next, updatedAt: FieldValue.serverTimestamp() });
  batch.set(db.collection("auditLogs").doc(), serverAuditEntry(null, { action: "subscription.status_synced", targetType: "customer", targetId: sub.customerId, targetLabel: sub.plan, metadata: { from: sub.status, to: next } }));
  await batch.commit();
  return next;
}

async function createCycleInvoice(db: Firestore, sub: Subscription, settings: AppSettings, today: string): Promise<{ created: boolean; invoiceId: string }> {
  const invoiceId = `sub_${sub.id}_${sub.nextBillingDate}`;
  const invRef = db.collection("invoices").doc(invoiceId);
  const counterRef = db.collection("settings").doc("counters");
  const subRef = db.collection("subscriptions").doc(sub.id);
  let created = false;

  await db.runTransaction(async (tx) => {
    const [invSnap, counters, subSnap] = await Promise.all([tx.get(invRef), tx.get(counterRef), tx.get(subRef)]);
    if (subSnap.data()?.nextBillingDate !== sub.nextBillingDate) return; // someone else moved it on
    if (!invSnap.exists) {
      const field = `invoice_${today.slice(0, 7).replace("-", "")}`;
      const seq = ((counters.data()?.[field] as number | undefined) ?? 0) + 1;
      const lines = [{
        description: `Malek Enterprise POS licence, ${sub.terminalLimit} terminal${sub.terminalLimit === 1 ? "" : "s"} (${sub.billingFrequency})`,
        quantity: sub.terminalLimit, unitPrice: sub.pricePerTerminal * MONTHS_PER_CYCLE[sub.billingFrequency],
      }];
      tx.set(counterRef, { [field]: seq, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      tx.set(invRef, {
        number: invoiceNumber(settings.billing.invoicePrefix, today, seq), customerId: sub.customerId, subscriptionId: sub.id,
        issueDate: today, dueDate: sub.nextBillingDate > today ? sub.nextBillingDate : today, status: "PENDING", lines,
        ...calcTotals(lines, settings.billing.vatRate), vatRate: settings.billing.vatRate, currency: "ZAR",
        paidAt: null, paidBy: null, paymentMethod: null, paymentNote: "", periodKey: sub.nextBillingDate,
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
      created = true;
    }
    tx.update(subRef, { nextBillingDate: advanceBillingDate(sub.nextBillingDate, sub.billingFrequency), updatedAt: FieldValue.serverTimestamp() });
  });
  return { created, invoiceId };
}

export type { BillingSummary };

/**
 * The daily job: bill what's due, flag what's late, keep subscription and licence standing in step,
 * queue reminders, and (if email is set up) send them. Safe to run more than once a day.
 */
export async function runBillingJob(db: Firestore, today: string = todayISO()): Promise<BillingSummary> {
  const summary: BillingSummary = { date: today, invoicesCreated: 0, markedOverdue: 0, remindersQueued: 0, statusChanges: 0, licencesExtended: 0, licenceWarnings: 0, emailsSent: 0, emailsFailed: 0 };
  const settings = mapSettings(await db.collection("settings").doc("app").get().then((s) => (s.exists ? (s.data() as Data) : null)));
  const notify = settings.notifications.sendReminders;

  const customers = new Map<string, Customer>((await db.collection("customers").get()).docs.map((d) => [d.id, mapCustomer(d.id, d.data() as Data)]));
  const loadSubs = async () => (await db.collection("subscriptions").get()).docs.map((d) => mapSubscription(d.id, d.data() as Data)).filter((s) => s.status !== "CANCELLED");
  const to = (id: string) => customers.get(id)?.email ?? "";
  const who = (id: string) => customers.get(id)?.businessName ?? "your business";

  // 1. Create invoices that are due
  for (const sub of await loadSubs()) {
    if (!sub.autoRenewal || !sub.nextBillingDate || sub.nextBillingDate > today) continue;
    const { created, invoiceId } = await createCycleInvoice(db, sub, settings, today);
    if (!created) continue;
    summary.invoicesCreated++;
    if (notify) {
      const inv = mapInvoice(invoiceId, (await db.collection("invoices").doc(invoiceId).get()).data() as Data);
      await queueOnce(db, `inv_${invoiceId}`, { type: "invoice_issued", customerId: sub.customerId, recipient: to(sub.customerId), title: `Invoice ${inv.number}`,
        message: `Hi ${who(sub.customerId)},\n\nInvoice ${inv.number} for ${formatZAR(inv.total)} has been issued and is due on ${inv.dueDate}.\n\nThank you.` });
    }
  }

  // 2 + 3. Overdue flags and pre-due reminders
  const pending = (await db.collection("invoices").where("status", "==", "PENDING").get()).docs.map((d) => mapInvoice(d.id, d.data() as Data));
  for (const inv of pending) {
    if (shouldMarkOverdue(inv, today)) {
      await db.collection("invoices").doc(inv.id).update({ status: "OVERDUE", updatedAt: FieldValue.serverTimestamp() });
      summary.markedOverdue++;
      if (notify && (await queueOnce(db, `overdue_${inv.id}`, { type: "payment_reminder", customerId: inv.customerId, recipient: to(inv.customerId), title: `Invoice ${inv.number} is overdue`,
        message: `Hi ${who(inv.customerId)},\n\nInvoice ${inv.number} for ${formatZAR(inv.total)} was due on ${inv.dueDate} and is now overdue. Please settle it to avoid your licence being suspended.\n\nThank you.` }))) summary.remindersQueued++;
    } else if (notify && isReminderDue(inv, today, settings.billing.reminderDaysBefore)) {
      if (await queueOnce(db, `remind_${inv.id}`, { type: "payment_reminder", customerId: inv.customerId, recipient: to(inv.customerId), title: `Invoice ${inv.number} is due soon`,
        message: `Hi ${who(inv.customerId)},\n\nA friendly reminder that invoice ${inv.number} for ${formatZAR(inv.total)} is due on ${inv.dueDate}.\n\nThank you.` })) summary.remindersQueued++;
    }
  }

  // 4. Subscription standing (pending → overdue → suspended, or back to active once paid)
  const subs = await loadSubs();
  for (const sub of subs) {
    const next = await reconcileSubscription(db, sub, today);
    if (!next) continue;
    summary.statusChanges++;
    if (notify && (next === "OVERDUE" || next === "SUSPENDED")) {
      await queueOnce(db, `substatus_${sub.id}_${next}_${today}`, { type: "subscription_status", customerId: sub.customerId, recipient: to(sub.customerId),
        title: next === "SUSPENDED" ? "Your licence has been suspended" : "Your account is overdue",
        message: next === "SUSPENDED" ? `Hi ${who(sub.customerId)},\n\nYour Malek Enterprise POS licence has been suspended because payment is outstanding. It will be restored as soon as the account is settled.` : `Hi ${who(sub.customerId)},\n\nYour Malek Enterprise POS account is overdue. Your system keeps working during the grace period, but please settle the account.` });
    }
  }

  // 5. Licence renewals and expiry warnings
  const fresh = new Map((await loadSubs()).map((s) => [s.id, s]));
  for (const doc of (await db.collection("licenses").get()).docs) {
    const lic = mapLicense(doc.id, doc.data() as Data);
    if (lic.revoked || lic.status === "REVOKED") continue;
    const sub = fresh.get(lic.subscriptionId ?? "");
    if (sub?.status === "ACTIVE") {
      const expiry = renewedExpiry(lic.expiryDate, sub.nextBillingDate, sub.gracePeriodDays);
      if (expiry !== lic.expiryDate) { await doc.ref.update({ expiryDate: expiry, terminalLimit: sub.terminalLimit, updatedAt: FieldValue.serverTimestamp() }); summary.licencesExtended++; }
    } else {
      const left = daysBetween(today, lic.expiryDate);
      if (notify && left >= 0 && left <= 14 && (await queueOnce(db, `licexp_${lic.id}_${lic.expiryDate}`, { type: "license_expiry", customerId: lic.customerId, recipient: to(lic.customerId),
        title: "Your licence expires soon", message: `Hi ${who(lic.customerId)},\n\nYour Malek Enterprise POS licence expires on ${lic.expiryDate}. Settle any outstanding invoices to keep it running.` }))) summary.licenceWarnings++;
    }
  }

  // 6. Deliver queued emails if a provider is connected
  if (settings.notifications.emailEnabled && emailConfigured()) {
    const queued = await db.collection("notifications").where("status", "==", "queued").where("channel", "==", "email").limit(50).get();
    for (const d of queued.docs) {
      const r = await deliverNotification(db, d.id);
      if (r.status === "sent") summary.emailsSent++; else summary.emailsFailed++;
    }
  }

  await db.collection("auditLogs").add(serverAuditEntry(null, { action: "billing.job_run", targetType: "system", targetId: "billing", targetLabel: today, metadata: { ...summary } }));
  return summary;
}


