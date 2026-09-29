import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { BillingFrequency, Customer, Subscription } from "@/types";
import { HttpError } from "@/lib/httpError";
import { addDays, todayISO } from "@/lib/dates";
import { advanceBillingDate, MONTHS_PER_CYCLE } from "@/lib/billing/lifecycle";
import { invoiceNumber } from "@/lib/billing/invoiceRules";
import { serverAuditEntry } from "@/lib/firebase/serverAudit";
import { issueLicense } from "@/lib/licensing/issue";
import { computeLicenseState, renewedExpiry } from "@/lib/licensing/rules";
import { mapCustomer, mapInvoice, mapLicense, mapPayment, mapPricing, mapSettings, mapSubscription, mapTerminal, type Data } from "@/lib/mappers";
import { queueOnce } from "@/lib/notifications/server";
import { effectivePrice, mayLinkByEmail, priceOrder, type OrderInput } from "./order";

export interface PortalUser { uid: string; email: string; emailVerified: boolean }

/** The customer record this signed-in user owns: linked by uid, or linked now by a VERIFIED matching email. */
export async function findCustomerForUser(db: Firestore, user: PortalUser): Promise<Customer | null> {
  const byUid = await db.collection("customers").where("authUid", "==", user.uid).limit(1).get();
  if (byUid.docs[0]) return mapCustomer(byUid.docs[0].id, byUid.docs[0].data() as Data);
  if (!user.emailVerified || !user.email) return null;
  const byEmail = await db.collection("customers").where("email", "==", user.email).limit(5).get();
  const doc = byEmail.docs.find((d) => !d.data().authUid && mayLinkByEmail(user, String(d.data().email ?? "")));
  if (!doc) return null;
  await doc.ref.update({ authUid: user.uid, updatedAt: FieldValue.serverTimestamp() });
  await db.collection("auditLogs").add(serverAuditEntry({ uid: user.uid, email: user.email }, { action: "customer.portal_linked", targetType: "customer", targetId: doc.id, targetLabel: user.email }));
  return mapCustomer(doc.id, doc.data() as Data);
}

async function loadPricing(db: Firestore) {
  const snap = await db.collection("pricing").doc("default").get();
  return mapPricing(snap.exists ? (snap.data() as Data) : {});
}

/** Creates the invoice for a plan purchase or upgrade. It becomes a licence once it is paid (see fulfilPaidOrders). */
export async function createOrder(db: Firestore, user: PortalUser, input: OrderInput) {
  if (!user.emailVerified) throw new HttpError(403, "Verify your email address first - we sent you a link.");
  const pricing = await loadPricing(db);
  const plan = pricing.plans.find((p) => p.id === input.planId);
  if (!plan) throw new HttpError(400, "That plan isn't available.");
  if (input.terminals < plan.minTerminals) throw new HttpError(400, `${plan.name} starts at ${plan.minTerminals} till${plan.minTerminals === 1 ? "" : "s"}.`);
  const settings = mapSettings((await db.collection("settings").doc("app").get()).data() as Data | null);

  let customer = await findCustomerForUser(db, user);
  let priceSource: string | undefined;
  if (customer) {
    priceSource = (await db.collection("customers").doc(customer.id).get()).data()?.priceSource as string | undefined;
  } else {
    const businessName = (input.businessName ?? "").trim();
    if (businessName.length < 2) throw new HttpError(400, "Enter your business name.");
    const ref = db.collection("customers").doc();
    await ref.set({
      name: (input.name ?? "").trim() || businessName, businessName, email: user.email, phone: input.phone ?? "", address: "", country: input.country || "South Africa",
      terminals: input.terminals, pricePerTerminal: plan.pricePerTerminal, currency: "ZAR", plan: plan.name, status: "active", subscriptionStatus: "NONE", notes: "Signed up through the customer portal.",
      authUid: user.uid, priceSource: "plan", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    await db.collection("auditLogs").add(serverAuditEntry({ uid: user.uid, email: user.email }, { action: "customer.self_registered", targetType: "customer", targetId: ref.id, targetLabel: businessName }));
    customer = mapCustomer(ref.id, (await ref.get()).data() as Data);
    priceSource = "plan";
  }
  if (customer.status === "inactive") throw new HttpError(403, "This account is inactive. Please contact support.");

  const price = effectivePrice({ pricePerTerminal: customer.pricePerTerminal, priceSource }, plan);
  const today = todayISO();
  const subs = (await db.collection("subscriptions").where("customerId", "==", customer.id).get()).docs.map((d) => mapSubscription(d.id, d.data() as Data)).filter((s) => s.status !== "CANCELLED");
  const totals = priceOrder({ pricePerTerminal: price, terminals: input.terminals, frequency: input.billingFrequency, vatRate: settings.billing.vatRate, planName: plan.name });

  // Only one open order at a time: a new choice replaces any unpaid earlier one.
  const open = await db.collection("invoices").where("customerId", "==", customer.id).get();
  for (const d of open.docs) {
    const inv = d.data();
    if (inv.orderKind === "purchase" && inv.status === "PENDING") await d.ref.update({ status: "CANCELLED", updatedAt: FieldValue.serverTimestamp() });
  }

  const invRef = db.collection("invoices").doc();
  const counterRef = db.collection("settings").doc("counters");
  await db.runTransaction(async (tx) => {
    const counters = await tx.get(counterRef);
    const field = `invoice_${today.slice(0, 7).replace("-", "")}`;
    const seq = ((counters.data()?.[field] as number | undefined) ?? 0) + 1;
    tx.set(counterRef, { [field]: seq, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(invRef, {
      number: invoiceNumber(settings.billing.invoicePrefix, today, seq), customerId: customer!.id, subscriptionId: subs[0]?.id ?? null,
      issueDate: today, dueDate: addDays(today, 7), status: "PENDING", ...totals, vatRate: settings.billing.vatRate, currency: "ZAR",
      paidAt: null, paidBy: null, paymentMethod: null, paymentNote: "",
      orderKind: "purchase", orderPlanId: plan.id, orderPlanName: plan.name, orderTerminals: input.terminals, orderFrequency: input.billingFrequency, orderUnitPrice: price, orderFulfilled: false,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { invoiceId: invRef.id, customerId: customer.id, total: totals.total };
}

/**
 * Turns every PAID purchase order that hasn't been processed yet into an active subscription and a licence.
 * Safe to call any time and as often as you like: each order is claimed atomically, so it is only ever fulfilled once.
 * Called after online payments, and whenever a customer opens their account (which also covers an admin marking a
 * bank-transfer invoice as paid by hand).
 */
export async function fulfilPaidOrders(db: Firestore, customerId: string): Promise<number> {
  const invs = (await db.collection("invoices").where("customerId", "==", customerId).get()).docs
    .filter((d) => d.data().orderKind === "purchase" && d.data().status === "PAID" && d.data().orderFulfilled !== true);
  let done = 0;
  for (const invDoc of invs) {
    const claimed = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(invDoc.ref);
      if (fresh.data()?.orderFulfilled === true) return false;
      tx.update(invDoc.ref, { orderFulfilled: true, fulfilledAt: FieldValue.serverTimestamp() });
      return true;
    });
    if (!claimed) continue;
    try {
      await fulfilOne(db, customerId, invDoc.id, invDoc.data() as Data);
      done++;
    } catch (e) {
      await invDoc.ref.update({ orderFulfilled: false }); // let the next call retry
      throw e;
    }
  }
  return done;
}

async function fulfilOne(db: Firestore, customerId: string, invoiceId: string, inv: Data) {
  const today = todayISO();
  const freq = (inv.orderFrequency as BillingFrequency) ?? "monthly";
  const terminals = Math.max(1, Number(inv.orderTerminals) || 1);
  const price = Number(inv.orderUnitPrice) || 0;
  const planName = String(inv.orderPlanName ?? "Standard");
  const settings = mapSettings((await db.collection("settings").doc("app").get()).data() as Data | null);
  const customerSnap = await db.collection("customers").doc(customerId).get();
  const customer = mapCustomer(customerSnap.id, customerSnap.data() as Data);

  const subs = (await db.collection("subscriptions").where("customerId", "==", customerId).get()).docs.map((d) => mapSubscription(d.id, d.data() as Data)).filter((s) => s.status !== "CANCELLED");
  const nextBillingDate = advanceBillingDate(today, freq);
  const subFields = { plan: planName, terminalLimit: terminals, pricePerTerminal: price, billingFrequency: freq, status: "ACTIVE", nextBillingDate, autoRenewal: true };

  let sub: Subscription;
  if (subs[0]) {
    await db.collection("subscriptions").doc(subs[0].id).update({ ...subFields, updatedAt: FieldValue.serverTimestamp() });
    sub = { ...subs[0], ...subFields } as Subscription;
  } else {
    const ref = db.collection("subscriptions").doc();
    await ref.set({ customerId, ...subFields, currency: "ZAR", startDate: today, gracePeriodDays: settings.billing.defaultGraceDays, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    sub = mapSubscription(ref.id, { customerId, ...subFields, currency: "ZAR", startDate: today, gracePeriodDays: settings.billing.defaultGraceDays } as Data);
  }
  await db.collection("invoices").doc(invoiceId).update({ subscriptionId: sub.id });
  const custUpdate: Data = { terminals, plan: planName, subscriptionStatus: "ACTIVE", updatedAt: FieldValue.serverTimestamp() };
  if (customerSnap.data()?.priceSource === "plan") custUpdate.pricePerTerminal = price;
  await db.collection("customers").doc(customerId).update(custUpdate);

  // Licence: extend the existing one (and lift a payment-related suspension), or issue the first one.
  const lics = (await db.collection("licenses").where("subscriptionId", "==", sub.id).get()).docs.map((d) => ({ ref: d.ref, lic: mapLicense(d.id, d.data() as Data) }));
  const live = lics.find((l) => !l.lic.revoked);
  let licenseId: string;
  let issuedNew = false;
  if (live) {
    licenseId = live.lic.id;
    await live.ref.update({ expiryDate: renewedExpiry(live.lic.expiryDate, nextBillingDate, sub.gracePeriodDays), terminalLimit: terminals, status: "ACTIVE", updatedAt: FieldValue.serverTimestamp() });
  } else {
    const issued = await issueLicense(db, { customerId, subscription: sub, expiryDate: renewedExpiry(today, nextBillingDate, sub.gracePeriodDays), actor: null, reason: `payment:${invoiceId}` });
    licenseId = issued.licenseId;
    issuedNew = true;
  }
  await db.collection("auditLogs").add(serverAuditEntry(null, { action: "order.fulfilled", targetType: "customer", targetId: customerId, targetLabel: String(inv.number ?? ""), metadata: { invoiceId, licenseId, terminals, plan: planName, issuedNew } }));
  await queueOnce(db, `order_${invoiceId}`, {
    type: "general", customerId, recipient: customer.email, title: "Payment received - your licence is ready",
    message: `Hi ${customer.businessName},\n\nThank you - invoice ${String(inv.number ?? "")} is paid and your ${planName} plan (${terminals} till${terminals === 1 ? "" : "s"}) is active. Sign in to your account to see your licence key and download the software.`,
  });
}

/** Everything the customer's account page shows. Never includes another customer's data or any key hash. */
export async function loadPortal(db: Firestore, user: PortalUser) {
  const customer = await findCustomerForUser(db, user);
  const pricing = await loadPricing(db);
  const settings = mapSettings((await db.collection("settings").doc("app").get()).data() as Data | null);
  const canTestPay = (process.env.PAYMENT_PROVIDER ?? "").toLowerCase() === "mock" && process.env.ALLOW_TEST_PAYMENTS === "true";
  const base = { emailVerified: user.emailVerified, email: user.email, plans: pricing.plans, billingFrequency: pricing.billingFrequency, vatRate: settings.billing.vatRate, canTestPay, supportEmail: settings.general.supportEmail };
  if (!customer) return { ...base, customer: null };

  await fulfilPaidOrders(db, customer.id); // picks up invoices an admin has just marked as paid
  const today = todayISO();
  const [subSnap, licSnap, invSnap, paySnap, termSnap, custSnap] = await Promise.all([
    db.collection("subscriptions").where("customerId", "==", customer.id).get(), db.collection("licenses").where("customerId", "==", customer.id).get(),
    db.collection("invoices").where("customerId", "==", customer.id).get(), db.collection("payments").where("customerId", "==", customer.id).get(),
    db.collection("terminals").where("customerId", "==", customer.id).get(), db.collection("customers").doc(customer.id).get(),
  ]);
  const subscription = subSnap.docs.map((d) => mapSubscription(d.id, d.data() as Data)).filter((s) => s.status !== "CANCELLED")[0] ?? null;
  const fresh = mapCustomer(custSnap.id, custSnap.data() as Data);
  // A price the admin set by hand for this customer (so the buy screen previews the real amount).
  const customPrice = custSnap.data()?.priceSource !== "plan" && fresh.pricePerTerminal > 0 ? fresh.pricePerTerminal : null;
  const invoices = invSnap.docs.map((d) => ({ ...mapInvoice(d.id, d.data() as Data), orderKind: String(d.data().orderKind ?? "") })).filter((i) => i.status !== "CANCELLED")
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.number.localeCompare(a.number)).slice(0, 25);
  return {
    ...base,
    customer: { id: fresh.id, businessName: fresh.businessName, name: fresh.name, email: fresh.email, phone: fresh.phone, plan: fresh.plan, terminals: fresh.terminals, status: fresh.status, subscriptionStatus: fresh.subscriptionStatus },
    subscription,
    customPrice,
    licenses: licSnap.docs.map((d) => mapLicense(d.id, d.data() as Data)).map((l) => ({
      id: l.id, tokenPrefix: l.tokenPrefix, terminalLimit: l.terminalLimit, issueDate: l.issueDate, expiryDate: l.expiryDate, revoked: l.revoked,
      state: computeLicenseState(l, subscription?.status ?? null, today), lastVerifiedAt: l.lastVerifiedAt,
    })),
    invoices,
    payments: paySnap.docs.map((d) => mapPayment(d.id, d.data() as Data)).filter((p) => p.status === "succeeded").sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? "")).slice(0, 25),
    terminals: termSnap.docs.map((d) => mapTerminal(d.id, d.data() as Data)).map((t) => ({ id: t.id, deviceName: t.deviceName, shopName: t.shopName, status: t.status, lastSeenAt: t.lastSeenAt, version: t.version })),
    monthsPerCycle: MONTHS_PER_CYCLE,
  };
}
