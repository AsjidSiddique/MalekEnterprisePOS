import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import type { AdminActor, AppSettings } from "@/types";
import { mapSettings, type Data } from "@/lib/mappers";
import { getDb } from "@/lib/firebase/client";
import { auditEntry } from "./auditService";
import { col, docRef, commitBatch } from "./base";

export async function getSettings(): Promise<AppSettings> {
  const snap = await getDoc(docRef("settings", "app"));
  return mapSettings(snap.exists() ? (snap.data() as Data) : null);
}

/** Saves the full settings and mirrors only the non-sensitive contact details to the public settings document. */
export async function saveSettings(actor: AdminActor, settings: AppSettings): Promise<void> {
  const batch = writeBatch(getDb());
  batch.set(docRef("settings", "app"), { ...settings, updatedAt: serverTimestamp() });
  batch.set(docRef("settings", "public"), {
    productName: settings.general.productName, supportEmail: settings.general.supportEmail, salesEmail: settings.general.salesEmail, updatedAt: serverTimestamp(),
  });
  batch.set(doc(col("auditLogs")), auditEntry(actor, { action: "settings.updated", targetType: "settings", targetId: "app", targetLabel: "Application settings" }));
  await commitBatch(batch);
}
