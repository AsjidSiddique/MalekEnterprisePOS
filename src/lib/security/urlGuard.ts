import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { HttpError } from "@/lib/httpError";

/**
 * Guards every server-side request to an admin-supplied download link, so a link can never be used to make our server
 * reach into private networks (SSRF): https only, no credentials, standard port, public addresses only, and every
 * redirect hop is re-checked.
 */
export class UrlGuardError extends HttpError {
  constructor(message: string, status = 400) {
    super(status, message);
  }
}

const BLOCKED_SUFFIXES = [".local", ".localhost", ".internal", ".lan", ".home", ".corp", ".intranet"];

export function isPrivateIp(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v.includes(":")) {
    if (v === "::" || v === "::1") return true;
    if (v.startsWith("::ffff:")) {
      const dotted = v.slice(7);
      return isIP(dotted) === 4 ? isPrivateIp(dotted) : true; // hex-form mapped addresses are blocked outright
    }
    if (/^f[cd]/.test(v)) return true; // fc00::/7 unique local
    if (/^fe[89ab]/.test(v)) return true; // fe80::/10 link local
    return false;
  }
  const [a = 0, b = 0] = v.split(".").map(Number);
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a >= 224) return true; // multicast and reserved
  return false;
}

/** Syntax and policy checks that need no network. Returns the parsed URL or throws UrlGuardError. */
export function parseExternalUrl(raw: string): URL {
  const text = raw.trim();
  if (text.length === 0 || text.length > 2048) throw new UrlGuardError("Enter a download link.");
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new UrlGuardError("That doesn't look like a valid link.");
  }
  if (url.protocol !== "https:") throw new UrlGuardError("Only secure https:// links are allowed.");
  if (url.username || url.password) throw new UrlGuardError("Links containing a username or password are not allowed.");
  if (url.port && url.port !== "443") throw new UrlGuardError("Only the standard https port is allowed.");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new UrlGuardError("That address is on a private network.");
  } else if (host === "localhost" || !host.includes(".") || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new UrlGuardError("That address is not a public website.");
  }
  return url;
}

/** Resolves the hostname and refuses if any address is private. */
export async function assertPublicHost(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new UrlGuardError("That address is on a private network.");
    return;
  }
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new UrlGuardError("We couldn't find that website. Check the link.", 422);
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) throw new UrlGuardError("That address is not a public website.");
}

export interface GuardedFetchOptions {
  method?: "GET" | "HEAD";
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRedirects?: number;
  /** Sent only to api.github.com requests, never to any other host or redirect target. */
  githubToken?: string;
}

const GITHUB_ASSET = /^\/repos\/[^/]+\/[^/]+\/releases\/assets\/\d+$/;

/** fetch() that validates the URL and each redirect hop. The body is not read. */
export async function guardedFetch(rawUrl: string, opts: GuardedFetchOptions = {}): Promise<{ res: Response; finalUrl: URL }> {
  const max = opts.maxRedirects ?? 5;
  let current = parseExternalUrl(rawUrl);
  for (let hop = 0; hop <= max; hop++) {
    await assertPublicHost(current.hostname);
    const headers: Record<string, string> = { "User-Agent": "MalekPOS-Downloads/1.0", ...opts.headers };
    if (current.hostname === "api.github.com") {
      if (GITHUB_ASSET.test(current.pathname)) headers.Accept = "application/octet-stream";
      if (opts.githubToken) headers.Authorization = `Bearer ${opts.githubToken}`;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);
    let res: Response;
    try {
      res = await fetch(current, { method: opts.method ?? "GET", headers, redirect: "manual", signal: controller.signal, cache: "no-store" });
    } catch {
      throw new UrlGuardError("We couldn't reach that link. Check it's correct and public.", 502);
    } finally {
      clearTimeout(timer);
    }
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel().catch(() => undefined);
      current = parseExternalUrl(new URL(location, current).toString());
      continue;
    }
    return { res, finalUrl: current };
  }
  throw new UrlGuardError("That link redirects too many times.", 422);
}

export interface LinkProbe {
  ok: boolean;
  status: number;
  sizeBytes: number;
  contentType: string;
  fileName: string;
  host: string;
  acceptsRanges: boolean;
}

const fileNameFrom = (disposition: string | null, url: URL): string => {
  const star = disposition?.match(/filename\*=(?:UTF-8'')?([^;]+)/i)?.[1];
  const plain = disposition?.match(/filename="?([^";]+)"?/i)?.[1];
  const raw = star ? decodeURIComponent(star.trim()) : plain ?? decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "");
  return raw.replace(/[\\/]/g, "_").slice(0, 200);
};

/** Checks a link is reachable and reports its size and type, using a 1-byte range request so nothing big is downloaded. */
export async function probeLink(rawUrl: string, githubToken?: string): Promise<LinkProbe> {
  const { res, finalUrl } = await guardedFetch(rawUrl, { headers: { Range: "bytes=0-0" }, githubToken });
  await res.body?.cancel().catch(() => undefined);
  const range = res.headers.get("content-range")?.match(/\/(\d+)$/);
  const length = Number(res.headers.get("content-length") ?? 0);
  const sizeBytes = range ? Number(range[1]) : res.status === 200 ? length : 0;
  const original = parseExternalUrl(rawUrl);
  return {
    ok: res.status === 200 || res.status === 206,
    status: res.status,
    sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : 0,
    contentType: (res.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "",
    fileName: fileNameFrom(res.headers.get("content-disposition"), original.pathname.length > 1 ? original : finalUrl),
    host: original.hostname,
    acceptsRanges: res.status === 206 || res.headers.get("accept-ranges") === "bytes",
  };
}
