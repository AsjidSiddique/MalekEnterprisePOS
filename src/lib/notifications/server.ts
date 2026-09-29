import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { emailConfigured, sendEmail } from "./email";

/** Idempotent: a deterministic id means the daily job can't queue the same reminder twice. */
export async function queueOnce(db: Firestore, id: string, data: {
  type: string; customerId: string | null; recipient: string; title: string; message: string; channel?: "email" | "in_app";
}): Promise<boolean> {
  try {
    await db.collection("notifications").doc(id).create({
      channel: "email", ...data, status: "queued", scheduledFor: null, sentAt: null, error: "",
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  } catch (e) {
    if ((e as { code?: number }).code === 6) return false; // ALREADY_EXISTS
    throw e;
  }
}

/** Sends one queued email notification and records the outcome on the document. */
export async function deliverNotification(db: Firestore, id: string): Promise<{ status: "sent" | "failed"; error?: string }> {
  const ref = db.collection("notifications").doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Notification not found.");
  const n = snap.data() ?? {};
  if (n.channel !== "email") return { status: "failed", error: "Only email notifications can be sent from here." };
  if (!n.recipient) {
    await ref.update({ status: "failed", error: "No recipient email address.", updatedAt: FieldValue.serverTimestamp() });
    return { status: "failed", error: "No recipient email address." };
  }
  if (!emailConfigured()) return { status: "failed", error: "Email isn't configured yet (RESEND_API_KEY / EMAIL_FROM)." };
  const res = await sendEmail({ to: String(n.recipient), subject: String(n.title), text: String(n.message) });
  if (res.ok) {
    await ref.update({ status: "sent", sentAt: FieldValue.serverTimestamp(), error: "", updatedAt: FieldValue.serverTimestamp() });
    return { status: "sent" };
  }
  await ref.update({ status: "failed", error: res.error, updatedAt: FieldValue.serverTimestamp() });
  return { status: "failed", error: res.error };
}
