"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";

/** Calls one of our /api/account routes with the signed-in customer's ID token. */
export async function accountFetch<T>(path: string, body?: unknown, method: "GET" | "POST" = body === undefined ? "GET" : "POST"): Promise<T> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("Sign in to continue.");
  const token = await user.getIdToken();
  const res = await fetch(path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}
