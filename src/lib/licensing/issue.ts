import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { Customer, Subscription } from "@/types";
import { addDays, addMonths, todayISO } from "@/lib/dates";
import { mapSettings, mapSubscription, type Data } from "@/lib/mappers";
import { serverAuditEntry, type ServerActor } from "@/lib/firebase/serverAudit";
import { openToken, encryptionKey, sealToken } from "./secretBox";
import { generateLicenseToken, hashToken, tokenPrefix } from "./token";

/** Keeps a sealed copy of the key (server-only collection) so the owner can view it in their account later. */
export async function storeLicenseSecret(db: Firestore, licenseId: string, token: string): Promise<boolean> {
  const key = encryptionKey();
  if (!key) return false;
  await db.collection("licenseSecrets").doc(licenseId).set({ sealed: sealToken(token, key), updatedAt: FieldValue.serverTimestamp() });
  return true;
}

export async function readLicenseSecret(db: Firestore, licenseId: string): Promise<string | null> {
  const key = encryptionKey();
  if (!key) return null;
  const snap = await db.collection("licenseSecrets").doc(licenseId).get();
  const sealed = snap.data()?.sealed;
  return typeof sealed === "string" ? openToken(sealed, key) : null;
}

/**
 * Makes sure the customer has a (non-cancelled) subscription, creating one from their customer record if not.
 * Auto-created subscriptions do NOT auto-renew: an admin who issues a licence by hand has not agreed to start
 * invoicing that customer every month. Switch auto-renewal on in Subscriptions when that is what you want.
 */
export async function ensureSubscription(db: Firestore, customer: Customer): Promise<Subscription> {
  const existing = (await db.collection("subscriptions").where("customerId", "==", customer.id).get()).docs
    .map((d) => mapSubscription(d.id, d.data() as Data)).filter((s) => s.status !== "CANCELLED");
  if (existing[0]) return existing[0];
  const settings = mapSettings((await db.collection("settings").doc("app").get()).data() as Data | null);
  const today = todayISO();
  const ref = db.collection("subscriptions").doc();
  const data = {
    customerId: customer.id, plan: customer.plan || "Standard", terminalLimit: Math.max(1, customer.terminals), pricePerTerminal: customer.pricePerTerminal,
    currency: "ZAR", billingFrequency: "monthly", startDate: today, nextBillingDate: addMonths(today, 1), status: "ACTIVE",
    gracePeriodDays: settings.billing.defaultGraceDays, autoRenewal: false, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(data);
  await db.collection("customers").doc(customer.id).update({ subscriptionStatus: "ACTIVE", updatedAt: FieldValue.serverTimestamp() });
  return mapSubscription(ref.id, { ...data, createdAt: null, updatedAt: null } as Data);
}

export async function issueLicense(db: Firestore, o: { customerId: string; subscription: Subscription; expiryDate?: string; actor: ServerActor | null; reason: string }) {
  const settings = mapSettings((await db.collection("settings").doc("app").get()).data() as Data | null);
  const today = todayISO();
  const expiryDate = o.expiryDate ?? addDays(today, settings.licensing.defaultValidityDays);
  const token = generateLicenseToken();
  const ref = db.collection("licenses").doc();
  await ref.set({
    customerId: o.customerId, subscriptionId: o.subscription.id, tokenHash: hashToken(token), tokenPrefix: tokenPrefix(token),
    terminalLimit: o.subscription.terminalLimit, issueDate: today, expiryDate, gracePeriodDays: o.subscription.gracePeriodDays,
    status: "ACTIVE", revoked: false, lastVerifiedAt: null, lastActivityAt: null, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  const kept = await storeLicenseSecret(db, ref.id, token);
  await db.collection("auditLogs").add(serverAuditEntry(o.actor, { action: "license.generated", targetType: "customer", targetId: o.customerId, targetLabel: tokenPrefix(token), metadata: { licenseId: ref.id, expiryDate, reason: o.reason, viewableByCustomer: kept } }));
  return { licenseId: ref.id, token, expiryDate };
}
