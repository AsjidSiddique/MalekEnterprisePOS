import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { deleteObject, ref as storageRef, uploadBytesResumable } from "firebase/storage";
import type { AdminActor, DownloadStats, LinkDeliveryMode, Release, ReleaseFile, ReleaseFileKind, ShareLink } from "@/types";
import type { ReleaseInput } from "@/lib/validation/schemas";
import { mapDownloadStats, mapRelease, mapShareLink } from "@/lib/mappers";
import { adminFetch } from "@/lib/api-client";
import { evaluatePublish } from "@/lib/releases/rules";
import { getDb, getFirebaseStorage } from "@/lib/firebase/client";
import { auditEntry } from "./auditService";
import { col, docRef, getOne, listDocs, newestFirst, whereEq, commitBatch } from "./base";

export const MAX_UPLOAD_BYTES = 2 * 1024 ** 3; // 2 GiB — keep in sync with storage.rules
const INSTALLER_EXTENSIONS = [".exe", ".msi", ".zip"];

export const listReleases = (): Promise<Release[]> => listDocs("releases", mapRelease, ...newestFirst());
export const getRelease = (id: string): Promise<Release | null> => getOne("releases", id, mapRelease);

const audit = (actor: AdminActor, action: Parameters<typeof auditEntry>[1]["action"], r: { id: string; version: string }, metadata?: Record<string, unknown>) =>
  auditEntry(actor, { action, targetType: "release", targetId: r.id, targetLabel: `v${r.version}`, metadata });

export async function createRelease(actor: AdminActor, input: ReleaseInput): Promise<string> {
  const existing = await listReleases();
  if (existing.some((r) => r.version === input.version)) throw new Error(`Version ${input.version} already exists.`);
  const batch = writeBatch(getDb());
  const ref = doc(col("releases"));
  batch.set(ref, {
    ...input, status: "draft", isLatest: false, files: [], publishedAt: null, archivedAt: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  batch.set(doc(col("auditLogs")), audit(actor, "release.created", { id: ref.id, version: input.version }));
  await commitBatch(batch);
  return ref.id;
}

export async function updateRelease(actor: AdminActor, release: Release, input: ReleaseInput): Promise<void> {
  if (input.version !== release.version) {
    const existing = await listReleases();
    if (existing.some((r) => r.id !== release.id && r.version === input.version)) throw new Error(`Version ${input.version} already exists.`);
  }
  const batch = writeBatch(getDb());
  batch.update(docRef("releases", release.id), { ...input, updatedAt: serverTimestamp() });
  batch.set(doc(col("auditLogs")), audit(actor, "release.updated", { id: release.id, version: input.version }));
  await commitBatch(batch);
}

const newFileId = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(16).padStart(2, "0")).join("");
const safeName = (n: string) => n.replace(/[^A-Za-z0-9._-]+/g, "_");

export function validateUpload(file: File, kind: ReleaseFileKind): string | null {
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_UPLOAD_BYTES) return "Files can be up to 2 GB.";
  if (kind === "installer" && !INSTALLER_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))) {
    return "Installers must be .exe, .msi or .zip files.";
  }
  return null;
}

/** Uploads to releases/{releaseId}/… and records the Storage *path* (not a URL) on the release document. */
export async function uploadReleaseFile(
  actor: AdminActor, release: Release, file: File, kind: ReleaseFileKind, onProgress: (percent: number) => void,
): Promise<void> {
  const problem = validateUpload(file, kind);
  if (problem) throw new Error(problem);

  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : "";
  const path = `releases/${release.id}/${kind === "installer" ? `installer${ext}` : safeName(file.name)}`;
  const task = uploadBytesResumable(storageRef(getFirebaseStorage(), path), file, {
    contentType: file.type || "application/octet-stream",
    customMetadata: { uploadedBy: actor.email, kind, originalName: file.name },
  });
  await new Promise<void>((resolve, reject) => {
    task.on("state_changed", (s) => onProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100)), reject, () => resolve());
  });

  const fresh = (await getRelease(release.id)) ?? release;
  const entry: ReleaseFile = {
    id: newFileId(), kind, name: file.name, source: "upload", storagePath: path, linkHost: "", deliveryMode: "proxy",
    sizeBytes: file.size, contentType: file.type || "application/octet-stream",
  };
  // A new installer replaces the old one whether it was uploaded or linked (server cleans up the old link).
  const replacedLinks = kind === "installer" ? fresh.files.filter((f) => f.kind === "installer" && f.source === "link") : [];
  const files = [...fresh.files.filter((f) => (kind === "installer" ? f.kind !== "installer" : f.storagePath !== path)), entry];
  const batch = writeBatch(getDb());
  batch.update(docRef("releases", release.id), { files, updatedAt: serverTimestamp() });
  batch.set(doc(col("auditLogs")), audit(actor, "release.file_uploaded", release, { kind, name: file.name, sizeBytes: file.size }));
  await commitBatch(batch);
  for (const old of replacedLinks) await adminFetch("/api/admin/releases/links", { action: "remove", releaseId: release.id, fileId: old.id }).catch(() => undefined);
}

export async function removeReleaseFile(actor: AdminActor, release: Release, file: ReleaseFile): Promise<void> {
  if (file.source === "link") {
    await adminFetch("/api/admin/releases/links", { action: "remove", releaseId: release.id, fileId: file.id });
    return;
  }
  try {
    await deleteObject(storageRef(getFirebaseStorage(), file.storagePath));
  } catch (e) {
    if ((e as { code?: string }).code !== "storage/object-not-found") throw e;
  }
  const fresh = (await getRelease(release.id)) ?? release;
  const batch = writeBatch(getDb());
  batch.update(docRef("releases", release.id), { files: fresh.files.filter((f) => f.id !== file.id), updatedAt: serverTimestamp() });
  batch.set(doc(col("auditLogs")), audit(actor, "release.file_removed", release, { kind: file.kind, name: file.name }));
  await commitBatch(batch);
}

export async function publishRelease(actor: AdminActor, release: Release, opts: { setAsLatest: boolean; requireChecksum: boolean }): Promise<void> {
  const all = await listReleases();
  const verdict = evaluatePublish(release, all);
  const errors = [...verdict.errors];
  if (opts.requireChecksum && !release.checksumSha256) errors.push("Add a SHA-256 checksum before publishing.");
  if (errors.length > 0) throw new Error(errors.join(" "));

  const batch = writeBatch(getDb());
  batch.update(docRef("releases", release.id), { status: "published", isLatest: opts.setAsLatest, publishedAt: serverTimestamp(), archivedAt: null, updatedAt: serverTimestamp() });
  if (opts.setAsLatest) {
    all.filter((r) => r.id !== release.id && r.isLatest).forEach((r) => batch.update(docRef("releases", r.id), { isLatest: false, updatedAt: serverTimestamp() }));
  }
  batch.set(doc(col("auditLogs")), audit(actor, "release.published", release, { setAsLatest: opts.setAsLatest }));
  await commitBatch(batch);
}

export async function archiveRelease(actor: AdminActor, release: Release): Promise<void> {
  const batch = writeBatch(getDb());
  batch.update(docRef("releases", release.id), { status: "archived", isLatest: false, archivedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.set(doc(col("auditLogs")), audit(actor, "release.archived", release));
  await commitBatch(batch);
}

export async function deleteRelease(actor: AdminActor, release: Release): Promise<void> {
  await adminFetch("/api/admin/releases/links", { action: "purge", releaseId: release.id });
  for (const f of release.files.filter((x) => x.source === "upload")) {
    try {
      await deleteObject(storageRef(getFirebaseStorage(), f.storagePath));
    } catch (e) {
      if ((e as { code?: string }).code !== "storage/object-not-found") throw e;
    }
  }
  const batch = writeBatch(getDb());
  batch.delete(docRef("releases", release.id));
  batch.set(doc(col("auditLogs")), audit(actor, "release.deleted", release, { wasStatus: release.status }));
  await commitBatch(batch);
}

// ── Download links (files hosted elsewhere, e.g. a GitHub release) ─────────────────────────────

export interface LinkProbeResult { ok: boolean; status: number; sizeBytes: number; contentType: string; fileName: string; host: string; acceptsRanges: boolean }

export interface GithubLookup { repo: string; private: boolean; tokenConfigured: boolean; releases: import("@/lib/releases/github").GithubRelease[] }
export const findGithubReleases = (repo: string, tag?: string) => adminFetch<GithubLookup>("/api/admin/releases/links", { action: "github", repo, ...(tag ? { tag } : {}) });

export const testReleaseLink = (url: string) => adminFetch<LinkProbeResult>("/api/admin/releases/links", { action: "test", url });

export const addReleaseLink = (input: { releaseId: string; url: string; name?: string; kind: ReleaseFileKind; deliveryMode: LinkDeliveryMode }) =>
  adminFetch<{ file: ReleaseFile }>("/api/admin/releases/links", { action: "add", ...input });

export const checksumForLinkedFile = (releaseId: string, fileId: string) =>
  adminFetch<{ sha256: string; sizeBytes: number }>("/api/admin/releases/links", { action: "checksum", releaseId, fileId });

// ── Private share links and download statistics ──────────────────────────────────────────────

export const listShareLinks = (releaseId: string): Promise<ShareLink[]> => listDocs("shareLinks", mapShareLink, whereEq("releaseId", releaseId));

export const createShareLink = (input: { releaseId: string; fileId: string; ttlHours: number; maxUses: number; label: string }) =>
  adminFetch<{ id: string; url: string; expiresAt: string }>("/api/admin/releases/share", { action: "create", ...input });

export const revokeShareLink = (id: string) => adminFetch<{ ok: true }>("/api/admin/releases/share", { action: "revoke", id });

export const listDownloadStats = (): Promise<DownloadStats[]> => listDocs("downloads", mapDownloadStats);
