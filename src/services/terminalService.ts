import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import type { AdminActor, Terminal, TerminalStatus } from "@/types";
import { mapLicense, mapSubscription, mapTerminal } from "@/lib/mappers";
import { canRegisterTerminal, computeLicenseState } from "@/lib/licensing/rules";
import { todayISO } from "@/lib/dates";
import { getDb } from "@/lib/firebase/client";
import { auditEntry } from "./auditService";
import { col, docRef, getOne, listDocs, newestFirst, whereEq, commitBatch } from "./base";

export const listTerminals = (): Promise<Terminal[]> => listDocs("terminals", mapTerminal, ...newestFirst());
export const listTerminalsForCustomer = (customerId: string): Promise<Terminal[]> =>
  listDocs("terminals", mapTerminal, whereEq("customerId", customerId));

/** Disable / revoke / reactivate. Reactivating re-checks the customer's terminal limit. */
export async function setTerminalStatus(actor: AdminActor, terminal: Terminal, to: TerminalStatus): Promise<void> {
  if (to === "ACTIVE") {
    const license = await getOne("licenses", terminal.licenseId, mapLicense);
    if (!license) throw new Error("This terminal's licence no longer exists.");
    const sub = license.subscriptionId ? await getOne("subscriptions", license.subscriptionId, mapSubscription) : null;
    const siblings = await listDocs("terminals", mapTerminal, whereEq("licenseId", license.id));
    const check = canRegisterTerminal({
      state: computeLicenseState(license, sub?.status ?? null, todayISO()),
      terminalLimit: sub?.terminalLimit ?? license.terminalLimit,
      activeTerminals: siblings.filter((t) => t.status === "ACTIVE" && t.id !== terminal.id).length,
      alreadyActive: false,
    });
    if (!check.ok) throw new Error(check.reason);
  }
  const action = to === "ACTIVE" ? "terminal.reactivated" : to === "DISABLED" ? "terminal.disabled" : "terminal.revoked";
  const batch = writeBatch(getDb());
  batch.update(docRef("terminals", terminal.id), { status: to, updatedAt: serverTimestamp() });
  batch.set(doc(col("auditLogs")), auditEntry(actor, {
    action, targetType: "terminal", targetId: terminal.id, targetLabel: terminal.deviceName, metadata: { customerId: terminal.customerId, from: terminal.status },
  }));
  await commitBatch(batch);
}
