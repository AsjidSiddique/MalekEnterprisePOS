import { createHash } from "node:crypto";
import type { DocumentReference, Firestore } from "firebase-admin/firestore";
import type { License, LicenseState, Subscription } from "@/types";
import { HttpError } from "@/lib/firebase/admin";
import { mapLicense, mapSettings, mapSubscription, type Data } from "@/lib/mappers";
import { todayISO } from "@/lib/dates";
import { computeLicenseState, isOperational } from "./rules";
import { signLease } from "./lease";
import { hashToken, isWellFormedToken } from "./token";

export const terminalDocId = (licenseId: string, hardwareId: string) =>
  `${licenseId}_${createHash("sha256").update(hardwareId.trim()).digest("hex").slice(0, 16)}`;
export const hardwareHash = (hardwareId: string) => createHash("sha256").update(hardwareId.trim()).digest("hex");

export interface ResolvedLicense {
  ref: DocumentReference;
  license: License;
  subscription: Subscription | null;
  state: LicenseState;
  businessName: string;
}

/** Looks a licence up by the hash of the presented key. Unknown and malformed keys get the same answer. */
export async function resolveLicense(db: Firestore, token: unknown): Promise<ResolvedLicense> {
  if (typeof token !== "string" || !isWellFormedToken(token)) throw new HttpError(401, "That licence key isn't valid.");
  const found = await db.collection("licenses").where("tokenHash", "==", hashToken(token)).limit(1).get();
  const doc = found.docs[0];
  if (!doc) throw new HttpError(401, "That licence key isn't valid.");
  const license = mapLicense(doc.id, doc.data() as Data);
  const subDoc = license.subscriptionId ? await db.collection("subscriptions").doc(license.subscriptionId).get() : null;
  const subscription = subDoc?.exists ? mapSubscription(subDoc.id, subDoc.data() as Data) : null;
  const customer = await db.collection("customers").doc(license.customerId).get();
  const state = computeLicenseState(license, subscription?.status ?? null, todayISO());
  return { ref: doc.ref, license, subscription, state, businessName: String(customer.data()?.businessName ?? "") };
}

export async function offlineAllowanceDays(db: Firestore): Promise<number> {
  const s = await db.collection("settings").doc("app").get();
  return mapSettings(s.exists ? (s.data() as Data) : null).licensing.offlineGraceDays;
}

const MESSAGES: Record<LicenseState, string> = {
  ACTIVE: "Licence is active.",
  GRACE: "Payment is overdue or the licence has just expired. The system keeps working for now, but please settle the account.",
  SUSPENDED: "This licence is suspended. Contact support to restore it.",
  EXPIRED: "This licence has expired. Contact support to renew it.",
  REVOKED: "This licence has been revoked.",
};

/** The signed answer the POS stores locally and re-checks against its offline allowance. */
export function buildLease(r: ResolvedLicense, offlineDays: number, extra: { terminalStatus?: string; operational?: boolean } = {}) {
  const now = new Date();
  const operational = (extra.operational ?? true) && isOperational(r.state);
  const payload = {
    v: 1,
    licenseId: r.license.id,
    licensee: r.businessName,
    state: r.state,
    subscriptionStatus: r.subscription?.status ?? null,
    terminalLimit: r.subscription?.terminalLimit ?? r.license.terminalLimit,
    expiryDate: r.license.expiryDate,
    issuedAt: now.toISOString(),
    /** The POS may keep trading without contacting us until this moment. */
    validUntil: operational ? new Date(now.getTime() + offlineDays * 86_400_000).toISOString() : now.toISOString(),
    operational,
    terminalStatus: extra.terminalStatus ?? null,
  };
  return { valid: operational, state: r.state, message: MESSAGES[r.state], ...signLease(payload) };
}


