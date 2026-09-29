import { buildDemoSeed, type DemoDoc } from "./data";

/** A stand-in for Firestore's Timestamp that the app's mappers understand (they only need toDate()). */
export class FakeTimestamp {
  constructor(public ms: number) {}
  toDate() { return new Date(this.ms); }
  toMillis() { return this.ms; }
  toJSON() { return new Date(this.ms).toISOString(); }
}

export const SERVER_TS = { __sentinel: "serverTimestamp" } as const;

type Store = Map<string, Map<string, DemoDoc>>;
let store: Store | undefined;

export function clone<T>(v: T): T {
  if (v instanceof FakeTimestamp) return new FakeTimestamp(v.ms) as T;
  if (Array.isArray(v)) return v.map(clone) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, clone(x)])) as T;
  return v;
}

export function getStore(): Store {
  if (!store) {
    store = new Map();
    for (const [name, docs] of Object.entries(buildDemoSeed())) store.set(name, new Map(Object.entries(docs).map(([id, d]) => [id, clone(d)])));
  }
  return store;
}

export const collectionOf = (name: string): Map<string, DemoDoc> => {
  const s = getStore();
  if (!s.has(name)) s.set(name, new Map());
  return s.get(name)!;
};

/** Replaces server-timestamp placeholders with the current time. */
export function resolveWrite(data: DemoDoc): DemoDoc {
  const walk = (v: unknown): unknown => {
    if (v && typeof v === "object" && (v as { __sentinel?: string }).__sentinel === "serverTimestamp") return new FakeTimestamp(Date.now());
    if (v instanceof FakeTimestamp) return v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as object).filter(([, x]) => x !== undefined).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(data) as DemoDoc;
}

export const millis = (v: unknown): number => {
  if (v instanceof FakeTimestamp) return v.ms;
  if (typeof v === "string") { const t = Date.parse(v); return Number.isNaN(t) ? 0 : t; }
  return typeof v === "number" ? v : 0;
};

export const autoId = () => Array.from({ length: 20 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");

export function getPath(obj: DemoDoc, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as DemoDoc)[k] : undefined), obj);
}
