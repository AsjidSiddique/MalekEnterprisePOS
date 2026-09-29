import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb, HttpError, rateLimit, readJson, requireUser, route } from "@/lib/firebase/admin";
import { findCustomerForUser } from "@/lib/account/server";
import { readLicenseSecret } from "@/lib/licensing/issue";
import { serverAuditEntry } from "@/lib/firebase/serverAudit";
import { mapLicense, type Data } from "@/lib/mappers";

export const dynamic = "force-dynamic";
const body = z.object({ licenseId: z.string().min(1) });

/** Shows the owner their own licence key. Checks ownership first; every reveal is written to the audit log (never the key itself). */
export const POST = route(async (req) => {
  rateLimit(req, "account-reveal", 15);
  const user = await requireUser(req);
  const parsed = body.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, "Invalid request.");
  const db = adminDb();
  const customer = await findCustomerForUser(db, user);
  if (!customer) throw new HttpError(404, "No account found.");
  const snap = await db.collection("licenses").doc(parsed.data.licenseId).get();
  if (!snap.exists || String(snap.data()?.customerId) !== customer.id) throw new HttpError(404, "Licence not found.");
  const lic = mapLicense(snap.id, snap.data() as Data);
  if (lic.revoked) throw new HttpError(403, "This licence has been revoked. Contact support.");
  const token = await readLicenseSecret(db, lic.id);
  if (!token) throw new HttpError(409, "This key can't be shown here (it was issued before keys were stored). Ask support to regenerate it.");
  await db.collection("auditLogs").add(serverAuditEntry({ uid: user.uid, email: user.email }, { action: "license.viewed_by_customer", targetType: "customer", targetId: customer.id, targetLabel: lic.tokenPrefix, metadata: { licenseId: lic.id } }));
  return NextResponse.json({ ok: true, token });
});
