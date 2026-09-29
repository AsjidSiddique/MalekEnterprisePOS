import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb, HttpError, readJson, requireAdmin, route } from "@/lib/firebase/admin";
import { writeAudit } from "@/lib/firebase/serverAudit";
import { isValidISODate, todayISO } from "@/lib/dates";
import { ensureSubscription, issueLicense, storeLicenseSecret } from "@/lib/licensing/issue";
import { generateLicenseToken, hashToken, tokenPrefix } from "@/lib/licensing/token";
import { mapCustomer, mapLicense, mapSubscription, type Data } from "@/lib/mappers";

export const dynamic = "force-dynamic";

const date = z.string().refine(isValidISODate, "Use a valid date");
const commandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate"), customerId: z.string().min(1), subscriptionId: z.string().optional(), expiryDate: date.optional() }),
  z.object({ action: z.enum(["regenerate", "revoke", "reactivate"]), licenseId: z.string().min(1) }),
  z.object({ action: z.literal("extend"), licenseId: z.string().min(1), expiryDate: date }),
]);

/** All licence changes go through here so keys are generated and hashed on the server only. */
export const POST = route(async (req) => {
  const admin = await requireAdmin(req);
  const parsed = commandSchema.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request.");
  const cmd = parsed.data;
  const db = adminDb();
  const today = todayISO();

  if (cmd.action === "generate") {
    const customerSnap = await db.collection("customers").doc(cmd.customerId).get();
    if (!customerSnap.exists) throw new HttpError(404, "Customer not found.");
    const customer = mapCustomer(customerSnap.id, customerSnap.data() as Data);
    // No subscription yet? Create one from the customer's own record so a licence can be issued straight away.
    let sub;
    if (cmd.subscriptionId) {
      const subSnap = await db.collection("subscriptions").doc(cmd.subscriptionId).get();
      if (!subSnap.exists) throw new HttpError(404, "Subscription not found.");
      sub = mapSubscription(subSnap.id, subSnap.data() as Data);
      if (sub.customerId !== cmd.customerId) throw new HttpError(400, "That subscription belongs to a different customer.");
    } else {
      sub = await ensureSubscription(db, customer);
    }
    if (sub.status === "CANCELLED") throw new HttpError(400, "That subscription is cancelled.");
    const existing = await db.collection("licenses").where("subscriptionId", "==", sub.id).get();
    if (existing.docs.some((d) => !mapLicense(d.id, d.data() as Data).revoked)) {
      throw new HttpError(409, "This customer already has an active licence. Regenerate its key instead.");
    }
    if (cmd.expiryDate && cmd.expiryDate < today) throw new HttpError(400, "The expiry date can't be in the past.");
    const issued = await issueLicense(db, { customerId: cmd.customerId, subscription: sub, expiryDate: cmd.expiryDate, actor: admin, reason: "admin" });
    return NextResponse.json({ ok: true, licenseId: issued.licenseId, token: issued.token });
  }

  const ref = db.collection("licenses").doc(cmd.licenseId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Licence not found.");
  const license = mapLicense(snap.id, snap.data() as Data);
  const audit = (action: string, metadata: Record<string, unknown> = {}) =>
    writeAudit(db, admin, { action, targetType: "customer", targetId: license.customerId, targetLabel: license.tokenPrefix, metadata: { licenseId: license.id, ...metadata } });

  switch (cmd.action) {
    case "regenerate": {
      if (license.revoked) throw new HttpError(400, "Reactivate this licence before regenerating its key.");
      const token = generateLicenseToken();
      await ref.update({ tokenHash: hashToken(token), tokenPrefix: tokenPrefix(token), updatedAt: FieldValue.serverTimestamp() });
      await storeLicenseSecret(db, license.id, token);
      await audit("license.regenerated", { previousPrefix: license.tokenPrefix, newPrefix: tokenPrefix(token) });
      return NextResponse.json({ ok: true, licenseId: license.id, token });
    }
    case "revoke":
      await ref.update({ revoked: true, status: "REVOKED", updatedAt: FieldValue.serverTimestamp() });
      await audit("license.revoked");
      break;
    case "reactivate":
      await ref.update({ revoked: false, status: "ACTIVE", updatedAt: FieldValue.serverTimestamp() });
      await audit("license.reactivated");
      break;
    case "extend":
      if (license.revoked) throw new HttpError(400, "This licence is revoked.");
      await ref.update({ expiryDate: cmd.expiryDate, status: "ACTIVE", updatedAt: FieldValue.serverTimestamp() });
      await audit("license.extended", { from: license.expiryDate, to: cmd.expiryDate });
      break;
  }
  return NextResponse.json({ ok: true, licenseId: license.id });
});
