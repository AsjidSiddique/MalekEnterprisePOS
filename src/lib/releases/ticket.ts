import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Short-lived download tickets. The public Download button asks the server for a ticket and is sent to a URL that only works
 * for a few minutes, for one release file. Scrapers can't build download URLs on their own, and a URL that leaks stops working.
 */
export const TICKET_TTL_MS = 5 * 60_000;

export interface TicketPayload { r: string; f: string; e: number }

/** Uses DOWNLOAD_SIGNING_SECRET if set, otherwise derives one from server-only secrets. Returns null if nothing is configured. */
export function downloadSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const explicit = env.DOWNLOAD_SIGNING_SECRET;
  if (explicit && explicit.length >= 16) return explicit;
  const base = env.FIREBASE_ADMIN_PRIVATE_KEY || env.CRON_SECRET;
  return base ? createHash("sha256").update(`malek-download-v1:${base}`).digest("hex") : null;
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const mac = (body: string, secret: string) => createHmac("sha256", secret).update(body).digest();

export function signTicket(releaseId: string, fileId: string, secret: string, now = Date.now(), ttlMs = TICKET_TTL_MS): string {
  const body = b64(JSON.stringify({ r: releaseId, f: fileId, e: now + ttlMs, n: randomBytes(6).toString("hex") }));
  return `${body}.${b64(mac(body, secret))}`;
}

export function verifyTicket(token: string, secret: string, now = Date.now()): TicketPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig || token.length > 400) return null;
  const expected = mac(body, secret);
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Partial<TicketPayload>;
    if (typeof p.r !== "string" || typeof p.f !== "string" || typeof p.e !== "number" || p.e < now) return null;
    return { r: p.r, f: p.f, e: p.e };
  } catch {
    return null;
  }
}

/** Share-link tokens are random secrets; only their hash is stored (like licence keys). */
export const newShareToken = () => randomBytes(24).toString("base64url");
export const hashShareToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** A header-safe download file name. */
export const safeDownloadName = (name: string) => name.replace(/[^A-Za-z0-9._ -]+/g, "_").replace(/^\.+/, "").slice(0, 120) || "download";

export const contentDisposition = (name: string) => {
  const safe = safeDownloadName(name);
  return `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
};
