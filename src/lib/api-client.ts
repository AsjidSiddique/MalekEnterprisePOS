"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";

/** Calls one of our own /api/admin routes with the signed-in admin's ID token. */
export async function adminFetch<T>(path: string, body?: unknown, method: "GET" | "POST" = "POST"): Promise<T> {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    const { demoAdminApi } = await import("@/lib/demo/api");
    return (await demoAdminApi(path, body as Record<string, unknown>)) as T;
  }
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("Sign in to continue.");
  const token = await user.getIdToken();
  const res = await fetch(path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}
