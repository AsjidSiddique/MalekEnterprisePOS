import { FieldValue, type Firestore } from "firebase-admin/firestore";

export interface ServerActor { uid: string; email: string }

/** Audit entry body for server-side writes (same shape the admin UI writes). Never put secrets in metadata. */
export function serverAuditEntry(
  actor: ServerActor | null,
  e: { action: string; targetType: string; targetId: string; targetLabel?: string; metadata?: Record<string, unknown> },
) {
  return {
    userId: actor?.uid ?? "system", userEmail: actor?.email ?? "system", action: e.action, targetType: e.targetType, targetId: e.targetId,
    targetLabel: e.targetLabel ?? "", metadata: e.metadata ?? {}, createdAt: FieldValue.serverTimestamp(),
  };
}

export async function writeAudit(db: Firestore, actor: ServerActor | null, e: Parameters<typeof serverAuditEntry>[1]) {
  await db.collection("auditLogs").add(serverAuditEntry(actor, e));
}
