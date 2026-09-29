import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb, HttpError, rateLimit, readJson, route } from "@/lib/firebase/admin";
import { renewedExpiry } from "@/lib/licensing/rules";
import { buildLease, offlineAllowanceDays, resolveLicense, terminalDocId } from "@/lib/licensing/server";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: z.string().max(64),
  hardwareId: z.string().min(8).max(200).optional(),
  version: z.string().max(32).optional(),
});

/**
 * Periodic licence check from the POS server. Public endpoint, authenticated by the licence key itself.
 * Returns a signed lease the POS caches; the lease says how long it may trade without checking in again.
 */
export const POST = route(async (req) => {
  rateLimit(req, "pos-verify", 60);
  const body = bodySchema.safeParse(await readJson(req));
  if (!body.success) throw new HttpError(400, "token is required.");
  const db = adminDb();
  const resolved = await resolveLicense(db, body.data.token);
  const offlineDays = await offlineAllowanceDays(db);

  const updates: Record<string, unknown> = { lastVerifiedAt: FieldValue.serverTimestamp(), lastActivityAt: FieldValue.serverTimestamp() };
  if (resolved.subscription) {
    updates.terminalLimit = resolved.subscription.terminalLimit;
    if (resolved.subscription.status === "ACTIVE") {
      const expiry = renewedExpiry(resolved.license.expiryDate, resolved.subscription.nextBillingDate, resolved.subscription.gracePeriodDays);
      if (expiry !== resolved.license.expiryDate) { updates.expiryDate = expiry; resolved.license.expiryDate = expiry; }
    }
  }
  await resolved.ref.update(updates);

  let terminalStatus: string | undefined;
  let terminalOk = true;
  if (body.data.hardwareId) {
    const termRef = db.collection("terminals").doc(terminalDocId(resolved.license.id, body.data.hardwareId));
    const term = await termRef.get();
    if (term.exists) {
      terminalStatus = String(term.data()?.status ?? "ACTIVE");
      terminalOk = terminalStatus === "ACTIVE";
      if (terminalOk) await termRef.update({ lastSeenAt: FieldValue.serverTimestamp(), ...(body.data.version ? { version: body.data.version } : {}), updatedAt: FieldValue.serverTimestamp() });
    } else {
      terminalStatus = "UNREGISTERED";
    }
  }

  const lease = buildLease(resolved, offlineDays, { operational: terminalOk, terminalStatus });
  return NextResponse.json(terminalOk ? lease : { ...lease, message: "This terminal has been disabled or unlinked by the administrator." });
});
