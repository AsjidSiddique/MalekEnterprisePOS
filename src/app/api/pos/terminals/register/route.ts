import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb, HttpError, rateLimit, readJson, route } from "@/lib/firebase/admin";
import { writeAudit } from "@/lib/firebase/serverAudit";
import { canRegisterTerminal } from "@/lib/licensing/rules";
import { buildLease, hardwareHash, offlineAllowanceDays, resolveLicense, terminalDocId } from "@/lib/licensing/server";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: z.string().max(64),
  hardwareId: z.string().min(8).max(200),
  deviceName: z.string().trim().min(1).max(80),
  version: z.string().max(32).default(""),
  localIp: z.string().max(45).default(""),
  shopName: z.string().max(80).default(""),
});

/**
 * A till activating itself with a licence key. The terminal limit is enforced inside a transaction so two tills
 * registering at the same moment can't both squeeze past the limit.
 */
export const POST = route(async (req) => {
  rateLimit(req, "pos-register", 20);
  const parsed = bodySchema.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request.");
  const input = parsed.data;
  const db = adminDb();
  const resolved = await resolveLicense(db, input.token);
  const termRef = db.collection("terminals").doc(terminalDocId(resolved.license.id, input.hardwareId));
  const activeQuery = db.collection("terminals").where("licenseId", "==", resolved.license.id).where("status", "==", "ACTIVE");

  const outcome = await db.runTransaction(async (tx) => {
    const [existing, active] = await Promise.all([tx.get(termRef), tx.get(activeQuery)]);
    const existingStatus = existing.exists ? String(existing.data()?.status ?? "ACTIVE") : null;
    if (existingStatus && existingStatus !== "ACTIVE") throw new HttpError(403, "This terminal was disabled or unlinked by the administrator. Contact support to re-enable it.");

    const check = canRegisterTerminal({
      state: resolved.state,
      terminalLimit: resolved.subscription?.terminalLimit ?? resolved.license.terminalLimit,
      activeTerminals: active.size,
      alreadyActive: existingStatus === "ACTIVE",
    });
    if (!check.ok) throw new HttpError(403, check.reason ?? "Registration isn't allowed.");

    const common = { deviceName: input.deviceName, version: input.version, localIp: input.localIp, lastSeenAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
    if (existing.exists) {
      tx.update(termRef, common);
      return { created: false };
    }
    tx.set(termRef, {
      ...common, customerId: resolved.license.customerId, licenseId: resolved.license.id, shopId: null, shopName: input.shopName,
      hardwareIdHash: hardwareHash(input.hardwareId), hardwareIdShort: hardwareHash(input.hardwareId).slice(0, 8), status: "ACTIVE",
      registeredAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp(),
    });
    return { created: true };
  });

  if (outcome.created) {
    await writeAudit(db, null, { action: "terminal.registered", targetType: "terminal", targetId: termRef.id, targetLabel: input.deviceName, metadata: { customerId: resolved.license.customerId, licenseId: resolved.license.id } });
  }
  await resolved.ref.update({ lastActivityAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  const lease = buildLease(resolved, await offlineAllowanceDays(db), { terminalStatus: "ACTIVE" });
  return NextResponse.json({ ...lease, terminalId: termRef.id, created: outcome.created }, { status: outcome.created ? 201 : 200 });
});
