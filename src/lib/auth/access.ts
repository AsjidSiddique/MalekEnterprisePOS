export type AuthStatus = "loading" | "signed-out" | "signed-in";
export type AdminAccess = "loading" | "login" | "unauthorized" | "allowed";

/** Decides what the admin shell renders. Server-side enforcement lives in Firestore/Storage rules and API routes. */
export function resolveAdminAccess(status: AuthStatus, isAdmin: boolean): AdminAccess {
  if (status === "loading") return "loading";
  if (status === "signed-out") return "login";
  return isAdmin ? "allowed" : "unauthorized";
}
