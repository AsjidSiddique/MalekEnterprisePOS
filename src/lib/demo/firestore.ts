/* Demo-mode replacement for "firebase/firestore" (see next.config.mjs). Implements only what the app uses. */
import { autoId, clone, collectionOf, getPath, millis, resolveWrite, SERVER_TS, FakeTimestamp } from "./store";
import type { DemoDoc } from "./data";

type Ref = { type: "doc"; col: string; id: string };
type ColRef = { type: "collection"; name: string };
type Constraint = { t: "where"; field: string; op: string; value: unknown } | { t: "order"; field: string; dir: "asc" | "desc" } | { t: "limit"; n: number };
type Query = { type: "query"; col: string; cs: Constraint[] };

export const getFirestore = () => ({ demo: true });
export const initializeFirestore = () => ({ demo: true });
export const serverTimestamp = () => SERVER_TS;
export { FakeTimestamp as Timestamp };

export const collection = (_db: unknown, name: string): ColRef => ({ type: "collection", name });
export function doc(a: ColRef | unknown, b?: string, c?: string): Ref {
  if ((a as ColRef).type === "collection") return { type: "doc", col: (a as ColRef).name, id: autoId() };
  return { type: "doc", col: b as string, id: c as string };
}
export const where = (field: string, op: string, value: unknown): Constraint => ({ t: "where", field, op, value });
export const orderBy = (field: string, dir: "asc" | "desc" = "asc"): Constraint => ({ t: "order", field, dir });
export const limit = (n: number): Constraint => ({ t: "limit", n });
export const query = (c: ColRef | Query, ...cs: Constraint[]): Query => ({ type: "query", col: (c as ColRef).name ?? (c as Query).col, cs: [...((c as Query).cs ?? []), ...cs] });

const snap = (col: string, id: string) => {
  const data = collectionOf(col).get(id);
  return { id, exists: () => data !== undefined, data: () => (data ? clone(data) : undefined), ref: { type: "doc", col, id } as Ref };
};

const tick = () => new Promise<void>((r) => setTimeout(r, 40));

export async function getDoc(ref: Ref) { await tick(); return snap(ref.col, ref.id); }

export async function getDocs(q: Query | ColRef) {
  await tick();
  const col = (q as ColRef).name ?? (q as Query).col;
  const cs = (q as Query).cs ?? [];
  let rows = [...collectionOf(col).entries()];
  for (const c of cs) if (c.t === "where") rows = rows.filter(([, d]) => (c.op === "==" ? getPath(d, c.field) === c.value : c.op === "in" ? (c.value as unknown[]).includes(getPath(d, c.field)) : true));
  for (const c of [...cs].reverse()) {
    if (c.t !== "order") continue;
    rows = rows.filter(([, d]) => getPath(d, c.field) !== undefined && getPath(d, c.field) !== null);
    rows.sort(([, a], [, b]) => (millis(getPath(a, c.field)) - millis(getPath(b, c.field))) * (c.dir === "desc" ? -1 : 1) || String(getPath(a, c.field)).localeCompare(String(getPath(b, c.field))) * (c.dir === "desc" ? -1 : 1));
  }
  const lim = cs.find((c) => c.t === "limit") as { n: number } | undefined;
  if (lim) rows = rows.slice(0, lim.n);
  const docs = rows.map(([id]) => snap(col, id));
  return { docs, size: docs.length, empty: docs.length === 0, forEach: (fn: (d: (typeof docs)[number]) => void) => docs.forEach(fn) };
}

const write = (ref: Ref, data: DemoDoc, merge: boolean) => {
  const existing = collectionOf(ref.col).get(ref.id);
  collectionOf(ref.col).set(ref.id, merge && existing ? { ...existing, ...resolveWrite(data) } : resolveWrite(data));
};

export async function addDoc(c: ColRef, data: DemoDoc) { await tick(); const ref = doc(c); write(ref, data, false); return ref; }
export async function setDoc(ref: Ref, data: DemoDoc, opts?: { merge?: boolean }) { await tick(); write(ref, data, Boolean(opts?.merge)); }
export async function updateDoc(ref: Ref, data: DemoDoc) {
  await tick();
  if (!collectionOf(ref.col).has(ref.id)) throw new Error("No document to update.");
  write(ref, data, true);
}
export async function deleteDoc(ref: Ref) { await tick(); collectionOf(ref.col).delete(ref.id); }

export function writeBatch() {
  const ops: (() => void)[] = [];
  return {
    set: (ref: Ref, data: DemoDoc, opts?: { merge?: boolean }) => { ops.push(() => write(ref, data, Boolean(opts?.merge))); },
    update: (ref: Ref, data: DemoDoc) => { ops.push(() => write(ref, data, true)); },
    delete: (ref: Ref) => { ops.push(() => { collectionOf(ref.col).delete(ref.id); }); },
    commit: async () => { await tick(); ops.forEach((f) => f()); },
  };
}

export async function runTransaction<T>(_db: unknown, fn: (tx: { get: (r: Ref) => Promise<ReturnType<typeof snap>>; set: (r: Ref, d: DemoDoc) => void; update: (r: Ref, d: DemoDoc) => void; delete: (r: Ref) => void }) => Promise<T>): Promise<T> {
  await tick();
  return fn({
    get: async (r) => snap(r.col, r.id),
    set: (r, d) => write(r, d, false),
    update: (r, d) => write(r, d, true),
    delete: (r) => { collectionOf(r.col).delete(r.id); },
  });
}
