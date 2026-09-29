import { describe, expect, it } from "vitest";
import { downloadSecret, hashShareToken, newShareToken, safeDownloadName, contentDisposition, signTicket, verifyTicket } from "@/lib/releases/ticket";
import { isPrivateIp, parseExternalUrl, UrlGuardError } from "@/lib/security/urlGuard";
import { mapRelease } from "@/lib/mappers";

describe("download link guard (SSRF protection)", () => {
  it("accepts ordinary public https links, including GitHub releases", () => {
    expect(parseExternalUrl("https://github.com/acme/pos/releases/download/v1.0.0/setup.exe").hostname).toBe("github.com");
    expect(parseExternalUrl("  https://objects.githubusercontent.com/x/y?token=abc  ").hostname).toBe("objects.githubusercontent.com");
  });

  it.each([
    ["http://example.com/a.exe", /https/],
    ["ftp://example.com/a.exe", /https/],
    ["https://user:pass@example.com/a.exe", /username/],
    ["https://example.com:8443/a.exe", /port/],
    ["https://localhost/a.exe", /public/],
    ["https://intranet/a.exe", /public/],
    ["https://printer.local/a.exe", /public/],
    ["https://127.0.0.1/a.exe", /private/],
    ["https://10.1.2.3/a.exe", /private/],
    ["https://192.168.0.5/a.exe", /private/],
    ["https://172.20.0.1/a.exe", /private/],
    ["https://169.254.169.254/latest/meta-data", /private/],
    ["https://[::1]/a.exe", /private/],
    ["not a url", /valid/],
    ["", /Enter/],
  ])("rejects %s", (url, message) => {
    expect(() => parseExternalUrl(url)).toThrowError(message);
    try { parseExternalUrl(url); } catch (e) { expect(e).toBeInstanceOf(UrlGuardError); }
  });

  it("classifies private and public addresses", () => {
    for (const ip of ["10.0.0.1", "127.0.0.1", "0.0.0.0", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "224.0.0.1", "::1", "fc00::1", "fd12::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "140.82.112.3", "172.32.0.1", "1.1.1.1", "2606:4700::1111"]) expect(isPrivateIp(ip), ip).toBe(false);
  });
});

describe("download tickets", () => {
  const secret = "s".repeat(32);
  it("verifies a fresh ticket and binds it to one release file", () => {
    const t = signTicket("rel1", "file1", secret, 1_000);
    expect(verifyTicket(t, secret, 2_000)).toMatchObject({ r: "rel1", f: "file1" });
  });
  it("expires after five minutes", () => {
    const t = signTicket("rel1", "file1", secret, 0);
    expect(verifyTicket(t, secret, 299_000)).not.toBeNull();
    expect(verifyTicket(t, secret, 301_000)).toBeNull();
  });
  it("rejects tampering, wrong secrets and junk", () => {
    const t = signTicket("rel1", "file1", secret, 0);
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ r: "other", f: "file1", e: Date.now() + 1e9 })).toString("base64url");
    expect(verifyTicket(`${forged}.${sig}`, secret, 1)).toBeNull();
    expect(verifyTicket(t, "x".repeat(32), 1)).toBeNull();
    expect(verifyTicket(`${body}.`, secret, 1)).toBeNull();
    expect(verifyTicket("garbage", secret, 1)).toBeNull();
    expect(verifyTicket("a".repeat(500), secret, 1)).toBeNull();
  });
  it("gives every ticket a different value", () => {
    expect(signTicket("r", "f", secret, 0)).not.toBe(signTicket("r", "f", secret, 0));
  });
  it("needs a configured secret", () => {
    expect(downloadSecret({} as NodeJS.ProcessEnv)).toBeNull();
    expect(downloadSecret({ CRON_SECRET: "abc" } as unknown as NodeJS.ProcessEnv)).toHaveLength(64);
    expect(downloadSecret({ DOWNLOAD_SIGNING_SECRET: "too short" } as unknown as NodeJS.ProcessEnv)).toBeNull();
  });
});

describe("share links and file names", () => {
  it("stores only a hash of the token", () => {
    const token = newShareToken();
    expect(token.length).toBeGreaterThanOrEqual(30);
    expect(hashShareToken(token)).toHaveLength(64);
    expect(hashShareToken(token)).not.toContain(token);
    expect(newShareToken()).not.toBe(token);
  });
  it("makes header-safe download names", () => {
    const name = safeDownloadName('../../etc/pass"wd.exe');
    expect(name).not.toMatch(/[\/\"]/);
    expect(name.startsWith(".")).toBe(false);
    expect(name.endsWith("wd.exe")).toBe(true);
    expect(safeDownloadName("")).toBe("download");
    expect(contentDisposition('a"b\r\nX: y.exe')).not.toMatch(/[\r\n]/);
  });
});

describe("release file mapping", () => {
  it("keeps files saved before link support working", () => {
    const r = mapRelease("r1", { version: "1.0.0", files: [{ kind: "installer", name: "a.exe", storagePath: "releases/r1/installer.exe", sizeBytes: 5 }] });
    expect(r.files[0]).toMatchObject({ source: "upload", deliveryMode: "proxy", id: "f1" });
  });
  it("never has a URL field on a linked file", () => {
    const r = mapRelease("r1", { files: [{ id: "abc", kind: "installer", name: "a.exe", source: "link", linkHost: "github.com", url: "https://secret", deliveryMode: "proxy" }] });
    expect(JSON.stringify(r)).not.toContain("secret");
    expect(r.files[0]?.linkHost).toBe("github.com");
  });
});

import { afterEach, beforeEach, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async (host: string) => (host === "internal.example.com" ? [{ address: "10.0.0.7", family: 4 }] : [{ address: "140.82.112.3", family: 4 }])),
}));

describe("guarded fetching of linked files", () => {
  const calls: { url: string; headers: Record<string, string>; redirect?: string }[] = [];
  beforeEach(() => { calls.length = 0; });
  afterEach(() => { vi.unstubAllGlobals(); });

  const stub = (handler: (url: string, headers: Record<string, string>) => Response) =>
    vi.stubGlobal("fetch", vi.fn(async (u: URL | string, init: RequestInit) => {
      const headers = (init.headers ?? {}) as Record<string, string>;
      calls.push({ url: String(u), headers, redirect: init.redirect });
      return handler(String(u), headers);
    }));

  it("follows redirects by hand and re-checks every hop", async () => {
    const { guardedFetch } = await import("@/lib/security/urlGuard");
    stub((url) => (url.startsWith("https://github.com/") ? new Response(null, { status: 302, headers: { location: "https://objects.githubusercontent.com/file" } }) : new Response("data", { status: 200 })));
    const { res, finalUrl } = await guardedFetch("https://github.com/a/b/releases/download/v1/x.exe");
    expect(res.status).toBe(200);
    expect(finalUrl.hostname).toBe("objects.githubusercontent.com");
    expect(calls.every((c) => c.redirect === "manual")).toBe(true);
  });

  it("refuses a redirect that points at a private address", async () => {
    const { guardedFetch } = await import("@/lib/security/urlGuard");
    stub(() => new Response(null, { status: 302, headers: { location: "https://169.254.169.254/latest/meta-data" } }));
    await expect(guardedFetch("https://github.com/a/b/x.exe")).rejects.toThrow(/private/i);
  });

  it("refuses a hostname that resolves to a private address", async () => {
    const { guardedFetch } = await import("@/lib/security/urlGuard");
    stub(() => new Response("nope"));
    await expect(guardedFetch("https://internal.example.com/x.exe")).rejects.toThrow(/public website/i);
    expect(calls).toHaveLength(0);
  });

  it("gives up on redirect loops", async () => {
    const { guardedFetch } = await import("@/lib/security/urlGuard");
    stub(() => new Response(null, { status: 302, headers: { location: "https://github.com/loop" } }));
    await expect(guardedFetch("https://github.com/loop", { maxRedirects: 3 })).rejects.toThrow(/too many/i);
  });

  it("sends the GitHub token only to the API asset URL, never to redirect targets", async () => {
    const { guardedFetch } = await import("@/lib/security/urlGuard");
    stub((url) => (url.startsWith("https://api.github.com/") ? new Response(null, { status: 302, headers: { location: "https://release-assets.githubusercontent.com/blob" } }) : new Response("data")));
    await guardedFetch("https://api.github.com/repos/o/r/releases/assets/123", { githubToken: "secret-token" });
    expect(calls[0]!.headers.Authorization).toBe("Bearer secret-token");
    expect(calls[0]!.headers.Accept).toBe("application/octet-stream");
    expect(calls[1]!.headers.Authorization).toBeUndefined();
  });

  it("never sends the token to an ordinary link", async () => {
    const { guardedFetch } = await import("@/lib/security/urlGuard");
    stub(() => new Response("data"));
    await guardedFetch("https://downloads.example.com/x.exe", { githubToken: "secret-token" });
    expect(calls[0]!.headers.Authorization).toBeUndefined();
  });

  it("probes size and file name with a one-byte range request", async () => {
    const { probeLink } = await import("@/lib/security/urlGuard");
    stub((_u, h) => new Response("x", { status: 206, headers: { "content-range": "bytes 0-0/151388160", "content-type": "application/octet-stream", "content-disposition": 'attachment; filename="Setup 1.4.exe"', "accept-ranges": "bytes" }, ...(h.Range ? {} : {}) }));
    const p = await probeLink("https://downloads.example.com/download?id=9");
    expect(calls[0]!.headers.Range).toBe("bytes=0-0");
    expect(p).toMatchObject({ ok: true, status: 206, sizeBytes: 151388160, fileName: "Setup 1.4.exe", host: "downloads.example.com", acceptsRanges: true });
  });

  it("reports failure for links that answer with an error", async () => {
    const { probeLink } = await import("@/lib/security/urlGuard");
    stub(() => new Response("gone", { status: 404 }));
    expect((await probeLink("https://downloads.example.com/missing.exe")).ok).toBe(false);
  });
});

import { mapGithubReleases, parseGithubRepo } from "@/lib/releases/github";

describe("GitHub release picker", () => {
  it("understands the ways people write a repository", () => {
    expect(parseGithubRepo("acme/malek-pos")).toBe("acme/malek-pos");
    expect(parseGithubRepo("https://github.com/acme/malek-pos")).toBe("acme/malek-pos");
    expect(parseGithubRepo("github.com/acme/malek-pos/releases/tag/v1.0.0")).toBe("acme/malek-pos");
    expect(parseGithubRepo("https://github.com/acme/malek-pos.git")).toBe("acme/malek-pos");
  });
  it("rejects anything that could change the API path", () => {
    for (const bad of ["", "acme", "acme/", "../etc/passwd", "acme/repo/../x", "a b/c", "acme/repo?x=1&y=2", "https://evil.com/acme/repo", "acme/re po"]) {
      expect(parseGithubRepo(bad), bad).toBeNull();
    }
  });
  it("keeps installer-type assets and skips drafts", () => {
    const json = [
      { tag_name: "v1.0.0", name: "One", draft: false, prerelease: false, published_at: "2026-09-01T00:00:00Z", assets: [
        { name: "Setup.exe", size: 520_000_000, download_count: 9, browser_download_url: "https://github.com/a/b/releases/download/v1.0.0/Setup.exe", url: "https://api.github.com/repos/a/b/releases/assets/1", content_type: "application/octet-stream" },
        { name: "notes.png", size: 10, browser_download_url: "https://github.com/x.png", url: "" },
      ] },
      { tag_name: "v0.9.0", draft: true, assets: [] },
      "junk", null,
    ];
    const out = mapGithubReleases(json);
    expect(out).toHaveLength(1);
    expect(out[0]!.assets.map((a) => a.name)).toEqual(["Setup.exe"]);
    expect(out[0]!.assets[0]).toMatchObject({ sizeBytes: 520_000_000, downloads: 9 });
  });
  it("accepts a single release object (the tag lookup) too", () => {
    expect(mapGithubReleases({ tag_name: "v2", assets: [] })).toHaveLength(1);
  });
});

describe("GitHub API requests", () => {
  it("sends the token to api.github.com listing calls but not to other hosts", async () => {
    const { guardedFetch } = await import("@/lib/security/urlGuard");
    const seen: Record<string, string>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: URL | string, init: RequestInit) => { seen.push((init.headers ?? {}) as Record<string, string>); return new Response("[]"); }));
    await guardedFetch("https://api.github.com/repos/a/b/releases?per_page=8", { githubToken: "t0k" });
    await guardedFetch("https://downloads.example.com/file.exe", { githubToken: "t0k" });
    vi.unstubAllGlobals();
    expect(seen[0]!.Authorization).toBe("Bearer t0k");
    expect(seen[0]!.Accept).toBeUndefined();
    expect(seen[1]!.Authorization).toBeUndefined();
  });
});
