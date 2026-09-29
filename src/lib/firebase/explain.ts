/**
 * Turns raw Firebase / network errors into something a person can act on. Pure (no Firebase imports),
 * so it is safe on both client and server and is unit-tested.
 */
export type ErrorKind = "unreachable" | "not-configured" | "permission" | "auth" | "timeout" | "not-found" | "unknown";

export interface Explained {
  kind: ErrorKind;
  /** Short, plain-English message shown to the person. */
  message: string;
  /** What to actually do about it. */
  hint: string;
}

const text = (e: unknown): string => (e instanceof Error ? e.message : typeof e === "string" ? e : "");
const code = (e: unknown): string => (typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "");

export function explainError(e: unknown): Explained {
  const msg = text(e);
  const c = code(e).toLowerCase();
  const m = msg.toLowerCase();

  if (e instanceof Error && e.name === "FirebaseNotConfiguredError") {
    return { kind: "not-configured", message: "Firebase isn't configured on this deployment.", hint: "Add the NEXT_PUBLIC_FIREBASE_* variables in Vercel, then redeploy." };
  }
  if (e instanceof Error && e.name === "TimeoutError") {
    return { kind: "timeout", message: "The database didn't answer in time.", hint: "Open /api/health - it shows whether the Firestore database exists and is reachable from the server." };
  }
  if (m.includes("client is offline") || m.includes("could not reach cloud firestore") || c.endsWith("unavailable")) {
    return {
      kind: "unreachable",
      message: "Can't reach the Firestore database.",
      hint: "Most often the Firestore database was never created (Firebase console > Firestore Database > Create database). Open /api/health to confirm - it tests this from the server, independent of your browser.",
    };
  }
  if (c.endsWith("permission-denied") || m.includes("missing or insufficient permissions")) {
    return { kind: "permission", message: "You don't have permission to read or write that.", hint: "Deploy the security rules (firebase deploy --only firestore:rules) and make sure this account has admin access (npm run admin:grant)." };
  }
  if (c.startsWith("auth/") || c.endsWith("unauthenticated")) {
    return { kind: "auth", message: "Your sign-in has a problem.", hint: "Sign out and back in. If it persists, check that this domain is listed under Firebase > Authentication > Settings > Authorized domains." };
  }
  if (c.endsWith("not-found") || m.includes("does not exist")) {
    return { kind: "not-found", message: "The database or record wasn't found.", hint: "If every page fails the same way, the Firestore database probably hasn't been created yet." };
  }
  return { kind: "unknown", message: msg || "Something went wrong.", hint: "Open the browser console (F12) for the full error, and /api/health for a server-side check." };
}

/** True when the failure is the kind /api/health can help diagnose. */
export const isConnectivityKind = (k: ErrorKind): boolean => k === "unreachable" || k === "timeout" || k === "not-found" || k === "not-configured";
