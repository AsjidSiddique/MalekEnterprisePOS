import { collection, doc, getDoc, getDocs, limit, orderBy, query, where, type QueryConstraint, type WriteBatch } from "firebase/firestore";
import { withTimeout } from "@/lib/async";
import { getDb } from "@/lib/firebase/client";
import type { CollectionName } from "@/lib/constants";
import type { Data } from "@/lib/mappers";

export const MAX_ROWS = 1000;

export const col = (name: CollectionName) => collection(getDb(), name);
export const docRef = (name: CollectionName, id: string) => doc(getDb(), name, id);

export const newestFirst = (): QueryConstraint[] => [orderBy("createdAt", "desc"), limit(MAX_ROWS)];
export const whereEq = (field: string, value: unknown) => where(field, "==", value);

export async function listDocs<T>(name: CollectionName, map: (id: string, d: Data) => T, ...constraints: QueryConstraint[]): Promise<T[]> {
  const snap = await getDocs(query(col(name), ...constraints));
  return snap.docs.map((d) => map(d.id, d.data() as Data));
}

export async function getOne<T>(name: CollectionName, id: string, map: (id: string, d: Data) => T): Promise<T | null> {
  const snap = await getDoc(docRef(name, id));
  return snap.exists() ? map(snap.id, snap.data() as Data) : null;
}

/**
 * Commits a batch, but fails after 20s instead of hanging. When Firestore is unreachable the SDK queues writes
 * offline and commit() never settles, so buttons like "Save" or "Publish" would spin forever with no message.
 */
export async function commitBatch(batch: WriteBatch, label = "Saving your changes"): Promise<void> {
  try {
    await withTimeout(batch.commit(), 20_000, label);
  } catch (e) {
    console.error(`[firestore] ${label} failed:`, e);
    throw e;
  }
}
