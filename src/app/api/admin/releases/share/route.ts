import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb, HttpError, readJson, requireAdmin, route } from "@/lib/firebase/admin";
import { writeAudit } from "@/lib/firebase/serverAudit";
import { getReleaseServer, pickFile } from "@/lib/releases/serve";
import { hashShareToken, newShareToken } from "@/lib/releases/ticket";

export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), releaseId: z.string().min(1).max(64), fileId: z.string().min(1).max(64), ttlHours: z.number().int().min(1).max(720), maxUses: z.number().int().min(1).max(1000), label: z.string().trim().max(80).default("") }),
  z.object({ action: z.literal("revoke"), id: z.string().length(64) }),
]);

export const POST = route(async (req) => {
  const admin = await requireAdmin(req);
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request.");
  const cmd = parsed.data;
  const db = adminDb();

  if (cmd.action === "revoke") {
    const ref = db.collection("shareLinks").doc(cmd.id);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, "Link not found.");
    await ref.update({ revoked: true, updatedAt: FieldValue.serverTimestamp() });
    await writeAudit(db, admin, { action: "release.share_revoked", targetType: "release", targetId: String(snap.data()?.releaseId), targetLabel: String(snap.data()?.label ?? "") });
    return NextResponse.json({ ok: true });
  }

  const release = await getReleaseServer(db, cmd.releaseId);
  if (!release) throw new HttpError(404, "Release not found.");
  const file = pickFile(release, cmd.fileId);
  if (!file) throw new HttpError(404, "File not found on this release.");

  const token = newShareToken();
  const id = hashShareToken(token);
  const expiresAt = Timestamp.fromMillis(Date.now() + cmd.ttlHours * 3_600_000);
  await db.collection("shareLinks").doc(id).set({
    releaseId: release.id, fileId: file.id, label: cmd.label, expiresAt, maxUses: cmd.maxUses, uses: 0, revoked: false,
    createdBy: admin.email, lastUsedAt: null, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  await writeAudit(db, admin, { action: "release.share_created", targetType: "release", targetId: release.id, targetLabel: `v${release.version}`, metadata: { fileId: file.id, ttlHours: cmd.ttlHours, maxUses: cmd.maxUses, label: cmd.label } });
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  return NextResponse.json({ ok: true, id, url: `${origin.replace(/\/$/, "")}/get/${token}`, expiresAt: expiresAt.toDate().toISOString() });
});
