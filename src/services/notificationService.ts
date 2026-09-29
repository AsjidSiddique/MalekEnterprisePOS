import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import type { AdminActor, Inquiry, NotificationRecord } from "@/types";
import type { z } from "zod";
import type { notificationSchema } from "@/lib/validation/schemas";
import { mapInquiry, mapNotification } from "@/lib/mappers";
import { adminFetch } from "@/lib/api-client";
import { getDb } from "@/lib/firebase/client";
import { auditEntry } from "./auditService";
import { col, listDocs, newestFirst, commitBatch } from "./base";

export const listNotifications = (): Promise<NotificationRecord[]> => listDocs("notifications", mapNotification, ...newestFirst());
export const listInquiries = (): Promise<Inquiry[]> => listDocs("inquiries", mapInquiry, ...newestFirst());

export async function queueNotification(actor: AdminActor, input: z.output<typeof notificationSchema>): Promise<string> {
  const batch = writeBatch(getDb());
  const ref = doc(col("notifications"));
  batch.set(ref, {
    ...input, status: "queued", scheduledFor: null, sentAt: null, error: "", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  batch.set(doc(col("auditLogs")), auditEntry(actor, { action: "notification.queued", targetType: "notification", targetId: ref.id, targetLabel: input.title, metadata: { channel: input.channel } }));
  await commitBatch(batch);
  return ref.id;
}

/** Delivery happens on the server so the email provider key never reaches the browser. */
export const sendNotification = (notificationId: string) =>
  adminFetch<{ ok: true; status: "sent" | "failed"; error?: string }>("/api/admin/notifications/send", { notificationId });
