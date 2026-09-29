import { NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, HttpError, rateLimit, readJson, requireAdmin, route } from "@/lib/firebase/admin";
import { adminDb } from "@/lib/firebase/admin";
import { writeAudit } from "@/lib/firebase/serverAudit";

export const dynamic = "force-dynamic";

async function listAdmins(selfUid: string) {
  const out: { uid: string; email: string; name: string; lastSignIn: string | null; createdAt: string | null; isYou: boolean }[] = [];
  let token: string | undefined;
  do {
    const page = await adminAuth().listUsers(1000, token);
    for (const u of page.users) {
      if (u.customClaims?.admin !== true) continue;
      out.push({ uid: u.uid, email: u.email ?? "", name: u.displayName ?? "", lastSignIn: u.metadata.lastSignInTime ? new Date(u.metadata.lastSignInTime).toISOString() : null,
        createdAt: u.metadata.creationTime ? new Date(u.metadata.creationTime).toISOString() : null, isYou: u.uid === selfUid });
    }
    token = page.pageToken;
  } while (token);
  return out.sort((a, b) => a.email.localeCompare(b.email));
}

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("invite"), email: z.string().trim().toLowerCase().email().max(160) }),
  z.object({ action: z.literal("revoke"), uid: z.string().min(1).max(128) }),
]);

/** Lists, adds and removes the people who can sign in to this admin panel. */
export const GET = route(async (req) => {
  const admin = await requireAdmin(req);
  return NextResponse.json({ admins: await listAdmins(admin.uid) });
});

export const POST = route(async (req) => {
  const admin = await requireAdmin(req);
  rateLimit(req, "team", 10);
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request.");
  const cmd = parsed.data;
  const db = adminDb();
  const auth = adminAuth();

  if (cmd.action === "invite") {
    let created = false;
    let user = await auth.getUserByEmail(cmd.email).catch(() => null);
    if (!user) { user = await auth.createUser({ email: cmd.email, emailVerified: false }); created = true; }
    await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), admin: true });
    // No password is ever created or shown: the new admin sets their own through this one-time link.
    const resetLink = await auth.generatePasswordResetLink(cmd.email);
    await writeAudit(db, admin, { action: "team.admin_added", targetType: "user", targetId: user.uid, targetLabel: cmd.email, metadata: { created } });
    return NextResponse.json({ ok: true, created, resetLink });
  }

  if (cmd.uid === admin.uid) throw new HttpError(400, "You can't remove your own access. Ask another admin to do it.");
  const admins = await listAdmins(admin.uid);
  const target = admins.find((a) => a.uid === cmd.uid);
  if (!target) throw new HttpError(404, "That person isn't an admin.");
  if (admins.length <= 1) throw new HttpError(400, "There must always be at least one admin.");
  const user = await auth.getUser(cmd.uid);
  await auth.setCustomUserClaims(cmd.uid, { ...(user.customClaims ?? {}), admin: false });
  await auth.revokeRefreshTokens(cmd.uid); // signs them out everywhere
  await writeAudit(db, admin, { action: "team.admin_removed", targetType: "user", targetId: cmd.uid, targetLabel: target.email });
  return NextResponse.json({ ok: true });
});
