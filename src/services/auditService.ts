import { withTimeout } from "@/lib/async";
import { addDoc, limit, orderBy, serverTimestamp, where } from "firebase/firestore";
import type { AdminActor, AuditLog } from "@/types";
import { mapAuditLog } from "@/lib/mappers";
import { col, listDocs, whereEq } from "./base";

export type AuditAction =
  | "auth.login"
  | "customer.created" | "customer.updated" | "customer.status_changed" | "customer.deleted"
  | "shop.created"
  | "subscription.created" | "subscription.updated" | "subscription.status_synced"
  | "invoice.created" | "invoice.status_changed" | "invoice.marked_paid"
  | "license.generated" | "license.regenerated" | "license.revoked" | "license.reactivated" | "license.extended"
  | "terminal.disabled" | "terminal.reactivated" | "terminal.revoked"
  | "release.created" | "release.updated" | "release.file_uploaded" | "release.published" | "release.archived" | "release.deleted" | "release.file_removed" | "release.link_added" | "release.link_removed" | "release.share_created" | "release.share_revoked"
  | "pricing.updated" | "pricing.customer_price_changed"
  | "settings.updated"
  | "notification.queued" | "notification.sent";

export interface AuditInput {
  action: AuditAction;
  targetType: string;
  targetId: string;
  targetLabel?: string;
  metadata?: Record<string, unknown>;
}

/** Builds the document body so services can add it to the same write batch as the change it describes. */
export function auditEntry(actor: AdminActor, input: AuditInput) {
  return {
    userId: actor.uid,
    userEmail: actor.email,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    targetLabel: input.targetLabel ?? "",
    metadata: input.metadata ?? {},
    createdAt: serverTimestamp(),
  };
}

/** Audit logs are append-only: there is intentionally no update or delete here (and none allowed by the rules). */
export async function recordAudit(actor: AdminActor, input: AuditInput): Promise<void> {
  await withTimeout(addDoc(col("auditLogs"), auditEntry(actor, input)), 20_000, "Recording the audit entry");
}

export const listAuditLogs = (max = 300): Promise<AuditLog[]> =>
  listDocs("auditLogs", mapAuditLog, orderBy("createdAt", "desc"), limit(max));

export async function listAuditForTarget(targetId: string): Promise<AuditLog[]> {
  const rows = await listDocs("auditLogs", mapAuditLog, whereEq("targetId", targetId), limit(200));
  return rows.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

/** Everything that happened to a customer, including their terminals (audited under the terminal's own id). */
export async function listAuditForCustomer(customerId: string): Promise<AuditLog[]> {
  const [direct, viaMeta] = await Promise.all([
    listDocs("auditLogs", mapAuditLog, whereEq("targetId", customerId), limit(200)),
    listDocs("auditLogs", mapAuditLog, where("metadata.customerId", "==", customerId), limit(200)),
  ]);
  const seen = new Set<string>();
  return [...direct, ...viaMeta]
    .filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true)))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}
