/** Demo-mode stand-in for the /api/admin/* routes: acts on the in-memory store instead of Firebase. */
import { collectionOf, clone, FakeTimestamp } from "./store";
import type { DemoDoc } from "./data";

const wait = (ms = 350) => new Promise((r) => setTimeout(r, ms));
const today = () => new Date().toISOString().slice(0, 10);
const hex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
const key = () => { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const g = () => Array.from({ length: 4 }, () => A[Math.floor(Math.random() * 32)]).join(""); return `MEP-${g()}-${g()}-${g()}-${g()}-${g()}`; };

const audit = (action: string, targetType: string, targetLabel: string, metadata: DemoDoc = {}) =>
  collectionOf("auditLogs").set(hex(12), { userId: "demo", userEmail: "admin@malek.example", action, targetType, targetId: targetLabel, targetLabel, metadata, createdAt: new FakeTimestamp(Date.now()) });

type Body = Record<string, unknown>;
const s = (v: unknown) => String(v ?? "");

export async function demoAdminApi(path: string, body: Body = {}): Promise<unknown> {
  await wait();

  if (path === "/api/admin/licenses") {
    const lic = collectionOf("licenses");
    const action = s(body.action);
    if (action === "generate") {
      const token = key(); const id = hex(10); const sub = collectionOf("subscriptions").get(s(body.subscriptionId)) ?? {};
      lic.set(id, { customerId: body.customerId, subscriptionId: body.subscriptionId, tokenHash: hex(64), tokenPrefix: token.slice(0, 8), terminalLimit: sub.terminalLimit ?? 1, issueDate: today(),
        expiryDate: s(body.expiryDate) || new Date(Date.now() + 35 * 86_400_000).toISOString().slice(0, 10), gracePeriodDays: 5, status: "ACTIVE", revoked: false, lastVerifiedAt: null, lastActivityAt: null, createdAt: new FakeTimestamp(Date.now()), updatedAt: new FakeTimestamp(Date.now()) });
      audit("license.generated", "customer", token.slice(0, 8));
      return { ok: true, licenseId: id, token };
    }
    const cur = lic.get(s(body.licenseId));
    if (!cur) throw new Error("Licence not found.");
    if (action === "regenerate") { const token = key(); lic.set(s(body.licenseId), { ...cur, tokenPrefix: token.slice(0, 8) }); audit("license.regenerated", "customer", token.slice(0, 8)); return { ok: true, token }; }
    if (action === "revoke") lic.set(s(body.licenseId), { ...cur, revoked: true, status: "REVOKED" });
    if (action === "reactivate") lic.set(s(body.licenseId), { ...cur, revoked: false, status: "ACTIVE" });
    if (action === "extend") lic.set(s(body.licenseId), { ...cur, expiryDate: body.expiryDate, status: "ACTIVE" });
    audit(`license.${action === "extend" ? "extended" : action === "revoke" ? "revoked" : "reactivated"}`, "customer", s(cur.tokenPrefix));
    return { ok: true };
  }

  if (path === "/api/admin/notifications/send") {
    const n = collectionOf("notifications").get(s(body.notificationId));
    if (n) collectionOf("notifications").set(s(body.notificationId), { ...n, status: "failed", error: "Email isn't configured yet (demo mode sends nothing)." });
    return { ok: true, status: "failed", error: "Demo mode doesn't send email." };
  }

  if (path === "/api/admin/system-status") {
    return { checks: [
      { id: "server", label: "Server credentials", ok: true, detail: "Demo mode: no real server is connected." },
      { id: "cron", label: "Daily billing job", ok: false, detail: "Set CRON_SECRET so the daily job can run." },
      { id: "signing", label: "Licence signing key", ok: false, detail: "Run npm run signing-key and set LICENSE_SIGNING_PRIVATE_KEY." },
      { id: "downloads", label: "Secure downloads", ok: true, detail: "Download links are signed and expire after five minutes." },
      { id: "payments", label: "Payment gateway", ok: false, detail: "No gateway connected. Record cash and bank payments with Mark as paid." },
      { id: "email", label: "Email delivery", ok: false, detail: "Add RESEND_API_KEY and EMAIL_FROM once your domain is verified." },
    ] };
  }

  if (path === "/api/admin/releases/links") {
    const action = s(body.action);
    if (action === "test") {
      const url = s(body.url);
      if (!/^https:\/\//i.test(url)) throw new Error("Only secure https:// links are allowed.");
      const host = new URL(url).hostname;
      return { ok: true, status: 206, sizeBytes: 524_288_000, contentType: "application/octet-stream", fileName: decodeURIComponent(url.split("?")[0]!.split("/").pop() || "MalekPOS-Setup.exe"), host, acceptsRanges: true };
    }
    if (action === "github") {
      const asset = (name: string, mb: number, dl: number, tag: string) => ({ name, sizeBytes: mb * 1_048_576, downloads: dl, contentType: "application/octet-stream", url: `https://github.com/${s(body.repo).replace(/^https?:\/\/github.com\//, "")}/releases/download/${tag}/${name}`, apiUrl: "" });
      return { ok: true, repo: s(body.repo).replace(/^https?:\/\/github.com\//, "") || "acme/malek-pos", private: false, tokenConfigured: false, releases: [
        { tag: "v1.5.0-beta", name: "Loyalty points (beta)", publishedAt: new Date(Date.now() - 86_400_000).toISOString(), prerelease: true, assets: [asset("MalekPOS-Setup-1.5.0-beta.exe", 496, 3, "v1.5.0-beta")] },
        { tag: "v1.4.2", name: "Faster GRV capture", publishedAt: new Date(Date.now() - 6 * 86_400_000).toISOString(), prerelease: false, assets: [asset("MalekPOS-Setup-1.4.2.exe", 493, 212, "v1.4.2"), asset("Quick-start-guide.pdf", 2, 63, "v1.4.2")] },
        { tag: "v1.4.1", name: "Stability release", publishedAt: new Date(Date.now() - 34 * 86_400_000).toISOString(), prerelease: false, assets: [asset("MalekPOS-Setup-1.4.1.exe", 488, 187, "v1.4.1")] },
      ] };
    }
    if (action === "add") {
      const rel = collectionOf("releases").get(s(body.releaseId)); if (!rel) throw new Error("Release not found.");
      const url = s(body.url); const name = s(body.name) || decodeURIComponent(url.split("?")[0]!.split("/").pop() || "download.exe");
      const file = { id: hex(10), kind: body.kind, name, source: "link", storagePath: "", linkHost: new URL(url).hostname, deliveryMode: body.deliveryMode, sizeBytes: 524_288_000, contentType: "application/octet-stream" };
      const files = (rel.files as DemoDoc[]).filter((f) => body.kind !== "installer" || f.kind !== "installer");
      collectionOf("releases").set(s(body.releaseId), { ...rel, files: [...files, file], updatedAt: new FakeTimestamp(Date.now()) });
      audit("release.link_added", "release", `v${s(rel.version)}`, { host: file.linkHost });
      return { ok: true, file };
    }
    if (action === "remove") {
      const rel = collectionOf("releases").get(s(body.releaseId)); if (!rel) throw new Error("Release not found.");
      collectionOf("releases").set(s(body.releaseId), { ...rel, files: (rel.files as DemoDoc[]).filter((f) => f.id !== body.fileId) });
      return { ok: true };
    }
    if (action === "checksum") return { ok: true, sha256: hex(64), sizeBytes: 524_288_000 };
    if (action === "purge") { collectionOf("downloads").delete(s(body.releaseId)); return { ok: true }; }
  }

  if (path === "/api/admin/releases/share") {
    if (s(body.action) === "revoke") { const d = collectionOf("shareLinks").get(s(body.id)); if (d) collectionOf("shareLinks").set(s(body.id), { ...d, revoked: true }); return { ok: true }; }
    const id = hex(64); const token = hex(32); const ttl = Number(body.ttlHours ?? 24);
    collectionOf("shareLinks").set(id, { releaseId: body.releaseId, fileId: body.fileId, label: body.label ?? "", expiresAt: new FakeTimestamp(Date.now() + ttl * 3_600_000), maxUses: body.maxUses, uses: 0, revoked: false, createdBy: "admin@malek.example", lastUsedAt: null, createdAt: new FakeTimestamp(Date.now()), updatedAt: new FakeTimestamp(Date.now()) });
    audit("release.share_created", "release", s(body.label));
    return { ok: true, id, url: `${window.location.origin}/get/${token}`, expiresAt: new Date(Date.now() + ttl * 3_600_000).toISOString() };
  }

  if (path === "/api/admin/billing/run") {
    audit("billing.job_run", "system", today());
    return { ok: true, summary: { date: today(), invoicesCreated: 2, markedOverdue: 1, remindersQueued: 3, statusChanges: 1, licencesExtended: 4, licenceWarnings: 1, emailsSent: 0, emailsFailed: 0 } };
  }

  if (path === "/api/admin/team") {
    const team = clone(TEAM);
    if (s(body.action) === "invite") { TEAM.push({ uid: hex(8), email: s(body.email), name: "", lastSignIn: null, createdAt: new Date().toISOString(), isYou: false }); return { ok: true, resetLink: `https://demo.example/reset?token=${hex(24)}` }; }
    if (s(body.action) === "revoke") { const i = TEAM.findIndex((u) => u.uid === body.uid); if (i >= 0) TEAM.splice(i, 1); return { ok: true }; }
    return { admins: team };
  }

  throw new Error(`Demo mode doesn't support ${path}.`);
}

const TEAM: { uid: string; email: string; name: string; lastSignIn: string | null; createdAt: string; isYou: boolean }[] = [
  { uid: "demo-admin", email: "admin@malek.example", name: "Asjad", lastSignIn: new Date().toISOString(), createdAt: new Date(Date.now() - 90 * 86_400_000).toISOString(), isYou: true },
  { uid: "u2", email: "mohamad@malek.example", name: "Mohamad", lastSignIn: new Date(Date.now() - 2 * 86_400_000).toISOString(), createdAt: new Date(Date.now() - 60 * 86_400_000).toISOString(), isYou: false },
];
