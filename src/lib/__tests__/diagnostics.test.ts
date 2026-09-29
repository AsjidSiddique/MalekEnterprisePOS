import { describe, expect, it } from "vitest";
import { TimeoutError, withTimeout } from "../async";
import { classifyAdminError, classifyRest, checkEnv } from "../firebase/diagnose";
import { explainError, isConnectivityKind } from "../firebase/explain";

describe("withTimeout", () => {
  it("resolves when the promise settles in time", async () => {
    await expect(withTimeout(Promise.resolve(7), 50, "x")).resolves.toBe(7);
  });
  it("rejects with a TimeoutError when it never settles (the Firestore-offline write hang)", async () => {
    const never = new Promise<never>(() => {});
    await expect(withTimeout(never, 20, "Saving")).rejects.toBeInstanceOf(TimeoutError);
  });
  it("passes through the original rejection", async () => {
    await expect(withTimeout(Promise.reject(new Error("boom")), 50)).rejects.toThrow("boom");
  });
});

describe("explainError", () => {
  it("recognises the exact 'client is offline' message from the screenshots", () => {
    const e = explainError(new Error("Failed to get document because the client is offline."));
    expect(e.kind).toBe("unreachable");
    expect(e.hint).toMatch(/Create database/);
    expect(e.hint).toMatch(/\/api\/health/);
  });
  it("maps permission-denied, auth and timeout", () => {
    expect(explainError(Object.assign(new Error("x"), { code: "permission-denied" })).kind).toBe("permission");
    expect(explainError(Object.assign(new Error("x"), { code: "auth/unauthorized-domain" })).kind).toBe("auth");
    expect(explainError(new TimeoutError("Loading", 30000)).kind).toBe("timeout");
  });
  it("flags not-configured, and only connectivity kinds offer diagnostics", () => {
    const nc = new Error("no config");
    nc.name = "FirebaseNotConfiguredError";
    expect(explainError(nc).kind).toBe("not-configured");
    expect(isConnectivityKind("unreachable")).toBe(true);
    expect(isConnectivityKind("permission")).toBe(false);
  });
  it("falls back to the raw message for unknown errors", () => {
    expect(explainError(new Error("weird")).message).toBe("weird");
  });
});

describe("checkEnv", () => {
  const good = {
    NEXT_PUBLIC_FIREBASE_API_KEY: "k", NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "a", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "p",
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "b", NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "m", NEXT_PUBLIC_FIREBASE_APP_ID: "i",
    FIREBASE_ADMIN_PROJECT_ID: "p", FIREBASE_ADMIN_CLIENT_EMAIL: "e@x", FIREBASE_ADMIN_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
  };
  it("passes with everything set", () => expect(checkEnv(good).every((c) => c.ok)).toBe(true));
  it("names exactly which variables are empty", () => {
    const c = checkEnv({ ...good, NEXT_PUBLIC_FIREBASE_APP_ID: "  ", NEXT_PUBLIC_FIREBASE_API_KEY: undefined });
    expect(c[0]?.ok).toBe(false);
    expect(c[0]?.detail).toContain("NEXT_PUBLIC_FIREBASE_APP_ID");
    expect(c[0]?.detail).toContain("NEXT_PUBLIC_FIREBASE_API_KEY");
  });
  it("catches a mangled private key and mismatched project IDs", () => {
    expect(checkEnv({ ...good, FIREBASE_ADMIN_PRIVATE_KEY: "not-a-key" })[1]?.ok).toBe(false);
    const mismatch = checkEnv({ ...good, FIREBASE_ADMIN_PROJECT_ID: "other" })[1];
    expect(mismatch?.ok).toBe(false);
    expect(mismatch?.detail).toMatch(/two different projects/);
  });
});

describe("classifyRest", () => {
  it("200 -> ok", () => expect(classifyRest(200, "{}").ok).toBe(true));
  it("missing database -> tells you to create it", () => {
    const c = classifyRest(404, JSON.stringify({ error: { message: "The database (default) does not exist for project x. Please visit https://console.cloud.google.com/datastore/setup?project=x" } }));
    expect(c.ok).toBe(false);
    expect(c.fix).toMatch(/Create database/);
  });
  it("document-level 404 means the database exists", () => {
    expect(classifyRest(404, JSON.stringify({ error: { message: 'Document "projects/x/databases/(default)/documents/pricing/default" not found.' } })).ok).toBe(true);
  });
  it("does NOT blame the rules for a 403 that isn't a Firestore rules response (e.g. a proxy block)", () => {
    const c = classifyRest(403, "Host not in allowlist: firestore.googleapis.com.");
    expect(c.ok).toBe(false);
    expect(c.detail).toMatch(/may be blocking/);
    expect(c.fix ?? "").not.toMatch(/firebase deploy/);
  });
  it("disabled API, locked rules and bad key are told apart", () => {
    expect(classifyRest(403, "Cloud Firestore API has not been used in project x before or it is disabled").fix).toMatch(/Enable/);
    expect(classifyRest(403, "Missing or insufficient permissions.").fix).toMatch(/firebase deploy/);
    expect(classifyRest(400, "API key not valid. Please pass a valid API key.").fix).toMatch(/API_KEY/);
  });
});

describe("classifyAdminError", () => {
  it("gRPC 5 NOT_FOUND -> create the database", () => {
    const c = classifyAdminError(Object.assign(new Error("5 NOT_FOUND: "), { code: 5 }), "L", "id");
    expect(c.ok).toBe(false);
    expect(c.fix).toMatch(/Create/);
  });
  it("permission denied and bad key are told apart", () => {
    expect(classifyAdminError(Object.assign(new Error("7 PERMISSION_DENIED"), { code: 7 }), "L", "id").fix).toMatch(/service account/i);
    expect(classifyAdminError(new Error("error:1E08010C:DECODER routines::unsupported"), "L", "id").fix).toMatch(/private key/i);
  });
  it("timeouts get a clear fix", () => {
    expect(classifyAdminError(new TimeoutError("Firestore admin read", 10000), "L", "id").fix).toMatch(/10 seconds/);
  });
});
