/**
 * Server-only Firebase Admin helpers. NEVER import this from a client component.
 * Credentials come from private environment variables and are never sent to the browser.
 */
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { NextResponse } from "next/server";

import { HttpError } from "@/lib/httpError";
import { FIRESTORE_DATABASE_ID } from "@/lib/firebase/databaseId";

export { HttpError };

export const adminConfigured = () =>
  Boolean(process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY);

function adminApp(): App {
  if (!adminConfigured()) {
    throw new HttpError(503, "Server credentials aren't configured. Add the FIREBASE_ADMIN_* variables (see SETUP.md).");
  }
  const existing = getApps()[0];
  if (existing) return existing;
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export const adminDb = (): Firestore => getFirestore(adminApp(), FIRESTORE_DATABASE_ID);

export function adminBucket() {
  const name = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!name) throw new HttpError(503, "Storage isn't configured (NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET).");
  return getStorage(adminApp()).bucket(name);
}

export const adminAuth = () => getAuth(adminApp());

/** Verifies the caller's Firebase ID token and requires the `admin` custom claim. */
export async function requireAdmin(req: Request): Promise<{ uid: string; email: string }> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new HttpError(401, "Sign in to continue.");
  let decoded;
  try {
    decoded = await getAuth(adminApp()).verifyIdToken(token);
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(401, "Your session has expired. Sign in again.");
  }
  if (decoded.admin !== true) throw new HttpError(403, "This account doesn't have admin access.");
  return { uid: decoded.uid, email: decoded.email ?? "" };
}

/**
 * Verifies the caller's Firebase ID token for a CUSTOMER (no admin claim needed). Returns the verified identity.
 * Callers that hand out anything tied to an email address must also check `emailVerified`.
 */
export async function requireUser(req: Request): Promise<{ uid: string; email: string; emailVerified: boolean }> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new HttpError(401, "Sign in to continue.");
  try {
    const d = await getAuth(adminApp()).verifyIdToken(token);
    return { uid: d.uid, email: (d.email ?? "").toLowerCase(), emailVerified: d.email_verified === true };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(401, "Your session has expired. Sign in again.");
  }
}

export function requireCronSecret(req: Request): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new HttpError(503, "CRON_SECRET isn't configured.");
  if (req.headers.get("authorization") !== `Bearer ${secret}`) throw new HttpError(401, "Unauthorised.");
}

/** Wraps a route handler so thrown HttpErrors become clean JSON responses and nothing else leaks. */
export function route(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const path = (() => { try { return new URL(req.url).pathname; } catch { return "(unknown path)"; } })();
    try {
      return await handler(req);
    } catch (e) {
      if (e instanceof HttpError) {
        // 4xx are the caller's problem (bad input, not signed in); 5xx mean the server/config is at fault - log those loudly.
        if (e.status >= 500) console.error(`[api] ${req.method} ${path} -> ${e.status}: ${e.message}`);
        else console.warn(`[api] ${req.method} ${path} -> ${e.status}: ${e.message}`);
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      console.error(`[api] ${req.method} ${path} crashed:`, e);
      return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
    }
  };
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

/** Best-effort in-memory limiter (per server instance). Use an edge/WAF limiter for real abuse protection. */
const hits = new Map<string, { count: number; reset: number }>();
export function rateLimit(req: Request, key: string, max = 30, windowMs = 60_000): void {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const k = `${key}:${ip}`;
  const now = Date.now();
  const entry = hits.get(k);
  if (!entry || entry.reset < now) {
    hits.set(k, { count: 1, reset: now + windowMs });
    return;
  }
  entry.count += 1;
  if (entry.count > max) throw new HttpError(429, "Too many requests. Try again shortly.");
}
