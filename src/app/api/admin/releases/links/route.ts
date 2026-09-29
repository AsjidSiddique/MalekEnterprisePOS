import { createHash, randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminBucket, adminDb, HttpError, readJson, requireAdmin, route } from "@/lib/firebase/admin";
import { writeAudit } from "@/lib/firebase/serverAudit";
import { mapRelease, type Data } from "@/lib/mappers";
import { guardedFetch, probeLink } from "@/lib/security/urlGuard";
import { mapGithubReleases, parseGithubRepo } from "@/lib/releases/github";
import type { ReleaseFile } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const kind = z.enum(["installer", "checksums", "documentation", "sql", "other"]);
const id = z.string().min(1).max(64);
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("test"), url: z.string().max(2048) }),
  z.object({ action: z.literal("github"), repo: z.string().max(200), tag: z.string().max(100).optional() }),
  z.object({ action: z.literal("add"), releaseId: id, url: z.string().max(2048), name: z.string().trim().max(160).optional(), kind, deliveryMode: z.enum(["proxy", "redirect"]) }),
  z.object({ action: z.literal("remove"), releaseId: id, fileId: id }),
  z.object({ action: z.literal("checksum"), releaseId: id, fileId: id }),
  z.object({ action: z.literal("purge"), releaseId: id }),
]);

const MAX_HASH_BYTES = 800 * 1024 ** 2;
const INSTALLER_EXT = /\.(exe|msi|zip)$/i;

/**
 * Manages download links for release files. Link URLs are stored in `releaseLinks` (no client access at all) and are only ever
 * read by server code. They are never logged, never returned to a browser, and never written to the audit log.
 */
export const POST = route(async (req) => {
  const admin = await requireAdmin(req);
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request.");
  const cmd = parsed.data;
  const github = process.env.GITHUB_TOKEN;

  if (cmd.action === "test") {
    const p = await probeLink(cmd.url, github);
    return NextResponse.json({ ok: p.ok, status: p.status, sizeBytes: p.sizeBytes, contentType: p.contentType, fileName: p.fileName, host: p.host, acceptsRanges: p.acceptsRanges });
  }

  if (cmd.action === "github") {
    const repo = parseGithubRepo(cmd.repo);
    if (!repo) throw new HttpError(400, 'Enter the repository as "owner/name", for example "acme/malek-pos".');
    const api = (path: string) => guardedFetch(`https://api.github.com/repos/${repo}${path}`, { headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, githubToken: github, timeoutMs: 15_000 });
    const [info, releases] = await Promise.all([
      api(""), api(cmd.tag ? `/releases/tags/${encodeURIComponent(cmd.tag)}` : "/releases?per_page=8"),
    ]);
    for (const r of [info, releases]) {
      if (r.res.status === 404) throw new HttpError(404, "GitHub can't find that repository or release. If the repository is private, add a GITHUB_TOKEN to the server settings.");
      if (r.res.status === 403 || r.res.status === 429) throw new HttpError(429, "GitHub is limiting requests. Wait a minute, or add a GITHUB_TOKEN to raise the limit.");
      if (!r.res.ok) throw new HttpError(502, `GitHub answered with HTTP ${r.res.status}.`);
    }
    const meta = (await info.res.json()) as { private?: boolean; full_name?: string };
    return NextResponse.json({ ok: true, repo: meta.full_name ?? repo, private: meta.private === true, tokenConfigured: Boolean(github), releases: mapGithubReleases(await releases.res.json()) });
  }

  const db = adminDb();
  const releaseRef = db.collection("releases").doc(cmd.releaseId);
  const linksRef = db.collection("releaseLinks").doc(cmd.releaseId);

  if (cmd.action === "purge") {
    const shares = await db.collection("shareLinks").where("releaseId", "==", cmd.releaseId).get();
    const batch = db.batch();
    shares.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(linksRef);
    batch.delete(db.collection("downloads").doc(cmd.releaseId));
    await batch.commit();
    return NextResponse.json({ ok: true });
  }

  const releaseSnap = await releaseRef.get();
  if (!releaseSnap.exists) throw new HttpError(404, "Release not found.");
  const release = mapRelease(releaseSnap.id, releaseSnap.data() as Data);

  if (cmd.action === "add") {
    const probe = await probeLink(cmd.url, github);
    if (!probe.ok) throw new HttpError(422, `The link answered with HTTP ${probe.status}. It must be a direct, public file link.`);
    if (/text\/html/i.test(probe.contentType)) throw new HttpError(422, "That link opens a web page, not a file. Use the direct download link to the file.");
    const name = (cmd.name || probe.fileName || "download").trim();
    if (cmd.kind === "installer" && !INSTALLER_EXT.test(name)) throw new HttpError(422, "Installers must be .exe, .msi or .zip files. Set the file name if the link doesn't end with one.");

    const entry: ReleaseFile = {
      id: randomBytes(5).toString("hex"), kind: cmd.kind, name, source: "link", storagePath: "", linkHost: probe.host,
      deliveryMode: cmd.deliveryMode, sizeBytes: probe.sizeBytes, contentType: probe.contentType || "application/octet-stream",
    };
    const replaced = cmd.kind === "installer" ? release.files.filter((f) => f.kind === "installer") : [];
    const files = [...release.files.filter((f) => !replaced.includes(f)), entry];

    const batch = db.batch();
    batch.update(releaseRef, { files, updatedAt: FieldValue.serverTimestamp() });
    batch.set(linksRef, {
      links: {
        ...Object.fromEntries(replaced.filter((f) => f.source === "link").map((f) => [f.id, FieldValue.delete()])),
        [entry.id]: { url: cmd.url.trim(), addedBy: admin.email, addedAt: FieldValue.serverTimestamp() },
      },
    }, { merge: true });
    await batch.commit();
    for (const old of replaced.filter((f) => f.source === "upload" && f.storagePath)) await adminBucket().file(old.storagePath).delete({ ignoreNotFound: true }).catch(() => undefined);
    await writeAudit(db, admin, { action: "release.link_added", targetType: "release", targetId: release.id, targetLabel: `v${release.version}`, metadata: { fileId: entry.id, kind: entry.kind, host: entry.linkHost, deliveryMode: entry.deliveryMode } });
    return NextResponse.json({ ok: true, file: entry });
  }

  const file = release.files.find((f) => f.id === cmd.fileId);
  if (!file) throw new HttpError(404, "File not found on this release.");

  if (cmd.action === "remove") {
    if (file.source !== "link") throw new HttpError(400, "Only linked files are removed here.");
    const batch = db.batch();
    batch.update(releaseRef, { files: release.files.filter((f) => f.id !== file.id), updatedAt: FieldValue.serverTimestamp() });
    batch.set(linksRef, { links: { [file.id]: FieldValue.delete() } }, { merge: true });
    await batch.commit();
    await writeAudit(db, admin, { action: "release.link_removed", targetType: "release", targetId: release.id, targetLabel: `v${release.version}`, metadata: { fileId: file.id, host: file.linkHost } });
    return NextResponse.json({ ok: true });
  }

  // checksum
  if (file.source !== "link") throw new HttpError(400, "Uploaded files are hashed in the browser.");
  const url = ((await linksRef.get()).data() as { links?: Record<string, { url?: string }> } | undefined)?.links?.[file.id]?.url;
  if (!url) throw new HttpError(404, "The link for that file is missing.");
  const { res } = await guardedFetch(url, { githubToken: github, timeoutMs: 20_000 });
  if (!res.ok || !res.body) throw new HttpError(502, `The file host answered with HTTP ${res.status}.`);
  const hash = createHash("sha256");
  const reader = res.body.getReader();
  const deadline = Date.now() + 250_000;
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_HASH_BYTES) { await reader.cancel(); throw new HttpError(413, "That file is too large to check here. Paste its SHA-256 instead."); }
    if (Date.now() > deadline) { await reader.cancel(); throw new HttpError(504, "The file took too long to download. Paste its SHA-256 instead."); }
    hash.update(value);
  }
  return NextResponse.json({ ok: true, sha256: hash.digest("hex"), sizeBytes: total });
});
