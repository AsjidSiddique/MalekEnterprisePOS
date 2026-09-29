import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { adminBucket, HttpError } from "@/lib/firebase/admin";
import { mapRelease, type Data } from "@/lib/mappers";
import { guardedFetch, parseExternalUrl } from "@/lib/security/urlGuard";
import type { Release, ReleaseFile } from "@/types";
import { contentDisposition } from "./ticket";

export const SIGNED_URL_TTL_MS = 5 * 60_000;

export async function getReleaseServer(db: Firestore, id: string): Promise<Release | null> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  const snap = await db.collection("releases").doc(id).get();
  return snap.exists ? mapRelease(snap.id, snap.data() as Data) : null;
}

export const pickFile = (release: Release, fileId?: string | null): ReleaseFile | null =>
  fileId ? release.files.find((f) => f.id === fileId) ?? null : release.files.find((f) => f.kind === "installer") ?? null;

/** Counts a download per release, per day and per file. Failures never block the download itself. */
export async function recordDownload(db: Firestore, releaseId: string, fileId: string): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  await db.collection("downloads").doc(releaseId).set(
    { total: FieldValue.increment(1), days: { [day]: FieldValue.increment(1) }, files: { [fileId]: FieldValue.increment(1) }, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  ).catch((e) => console.error("[downloads] count failed", e));
}

const NO_STORE = { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };

const parseRange = (req: Request): string | null => {
  const r = req.headers.get("range");
  return r && /^bytes=\d*-\d*$/.test(r) ? r : null;
};

/** True for a first request (or resume from 0), so download managers fetching many ranges count as one download. */
export const isFreshDownload = (req: Request) => {
  const r = parseRange(req);
  return !r || r.startsWith("bytes=0-");
};

/**
 * Serves one release file without ever exposing where it lives:
 *  - uploaded files get a signed Storage URL that expires in 5 minutes;
 *  - linked files are streamed through this server (the link stays hidden), or redirected if the admin chose that.
 */
export async function deliverFile(req: Request, db: Firestore, release: Release, file: ReleaseFile, opts: { count?: boolean } = {}): Promise<Response> {
  if (opts.count !== false && isFreshDownload(req)) void recordDownload(db, release.id, file.id);

  if (file.source === "upload") {
    const object = adminBucket().file(file.storagePath);
    const [exists] = await object.exists();
    if (!exists) throw new HttpError(404, "That file is no longer available.");
    const [url] = await object.getSignedUrl({
      version: "v4", action: "read", expires: Date.now() + SIGNED_URL_TTL_MS, responseDisposition: contentDisposition(file.name),
    });
    return new Response(null, { status: 302, headers: { Location: url, ...NO_STORE } });
  }

  const stored = (await db.collection("releaseLinks").doc(release.id).get()).data() as { links?: Record<string, { url?: string }> } | undefined;
  const url = stored?.links?.[file.id]?.url;
  if (typeof url !== "string") throw new HttpError(404, "That file is temporarily unavailable.");

  if (file.deliveryMode === "redirect") {
    parseExternalUrl(url);
    return new Response(null, { status: 302, headers: { Location: url, ...NO_STORE } });
  }

  const range = parseRange(req);
  const { res } = await guardedFetch(url, { headers: range ? { Range: range } : {}, githubToken: process.env.GITHUB_TOKEN, timeoutMs: 20_000 });
  if (res.status !== 200 && res.status !== 206) {
    await res.body?.cancel().catch(() => undefined);
    throw new HttpError(502, "The file host didn't return the file. Try again shortly.");
  }
  const headers = new Headers(NO_STORE);
  headers.set("Content-Type", "application/octet-stream");
  headers.set("Content-Disposition", contentDisposition(file.name));
  headers.set("Accept-Ranges", res.headers.get("accept-ranges") ?? (res.status === 206 ? "bytes" : "none"));
  for (const h of ["content-length", "content-range"]) {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(res.body, { status: res.status, headers });
}
