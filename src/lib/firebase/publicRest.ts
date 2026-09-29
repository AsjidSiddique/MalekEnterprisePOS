/**
 * Server-side reads of *public* Firestore data through the REST API.
 * Uses the same public web API key and the same security rules as any anonymous visitor, so no
 * service-account credentials are involved. Pages using this are cached and revalidated every minute.
 * If Firebase isn't configured (or the request fails) every function resolves to an empty result.
 */
import type { PricingConfig, Release } from "@/types";
import { mapPricing, mapRelease, type Data } from "@/lib/mappers";
import { pickLatest, compareVersions } from "@/lib/releases/rules";
import { FIRESTORE_DATABASE_ID } from "./databaseId";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

const base = () => `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${encodeURIComponent(FIRESTORE_DATABASE_ID)}/documents`;
export const isPublicDataConfigured = Boolean(projectId && apiKey);

type FsValue = {
  stringValue?: string; integerValue?: string; doubleValue?: number; booleanValue?: boolean; timestampValue?: string;
  nullValue?: null; arrayValue?: { values?: FsValue[] }; mapValue?: { fields?: Record<string, FsValue> };
};
interface FsDoc { name: string; fields?: Record<string, FsValue> }

export function parseValue(v: FsValue): unknown {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue?.values ?? []).map(parseValue);
  if ("mapValue" in v) return parseFields(v.mapValue?.fields ?? {});
  return null;
}

export function parseFields(fields: Record<string, FsValue>): Data {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, parseValue(v)]));
}

const docId = (name: string) => name.split("/").pop() ?? name;

async function getDocument(path: string): Promise<{ id: string; data: Data } | null> {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    const [col = "", id = ""] = path.split("/");
    const { buildDemoSeed } = await import("@/lib/demo/data");
    const d = buildDemoSeed()[col]?.[id];
    return d ? { id, data: d } : null;
  }
  if (!isPublicDataConfigured) return null;
  try {
    const res = await fetch(`${base()}/${path}?key=${apiKey}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const doc = (await res.json()) as FsDoc;
    return { id: docId(doc.name), data: parseFields(doc.fields ?? {}) };
  } catch {
    return null;
  }
}

export async function fetchPublishedReleases(): Promise<Release[]> {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    const { buildDemoSeed } = await import("@/lib/demo/data");
    return Object.entries(buildDemoSeed().releases ?? {}).map(([id, d]) => mapRelease(id, d)).filter((r) => r.status === "published").sort((a, b) => compareVersions(b.version, a.version));
  }
  if (!isPublicDataConfigured) return [];
  try {
    const res = await fetch(`${base()}:runQuery?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "releases" }],
          where: { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "published" } } },
          limit: 100,
        },
      }),
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as { document?: FsDoc }[];
    return rows
      .filter((r): r is { document: FsDoc } => Boolean(r.document))
      .map((r) => mapRelease(docId(r.document.name), parseFields(r.document.fields ?? {})))
      .sort((a, b) => compareVersions(b.version, a.version));
  } catch {
    return [];
  }
}

export async function fetchLatestRelease(): Promise<Release | null> {
  return pickLatest(await fetchPublishedReleases());
}

export async function fetchPricing(): Promise<PricingConfig | null> {
  const doc = await getDocument("pricing/default");
  return doc ? mapPricing(doc.data) : null;
}

export async function fetchPublicSettings(): Promise<{ supportEmail: string; salesEmail: string }> {
  const doc = await getDocument("settings/public");
  const d = doc?.data ?? {};
  return { supportEmail: typeof d.supportEmail === "string" ? d.supportEmail : "", salesEmail: typeof d.salesEmail === "string" ? d.salesEmail : "" };
}
