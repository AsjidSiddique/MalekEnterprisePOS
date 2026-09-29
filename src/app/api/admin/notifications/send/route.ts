import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb, HttpError, readJson, requireAdmin, route } from "@/lib/firebase/admin";
import { writeAudit } from "@/lib/firebase/serverAudit";
import { deliverNotification } from "@/lib/notifications/server";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  const admin = await requireAdmin(req);
  const body = z.object({ notificationId: z.string().min(1) }).safeParse(await readJson(req));
  if (!body.success) throw new HttpError(400, "notificationId is required.");
  const db = adminDb();
  const result = await deliverNotification(db, body.data.notificationId).catch((e: unknown) => {
    throw new HttpError(404, e instanceof Error ? e.message : "Notification not found.");
  });
  await writeAudit(db, admin, { action: "notification.sent", targetType: "notification", targetId: body.data.notificationId, metadata: { status: result.status } });
  return NextResponse.json({ ok: true, ...result });
});
