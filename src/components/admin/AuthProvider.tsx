"use client";

import { onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut, type User } from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase/client";
import type { AuthStatus } from "@/lib/auth/access";
import type { AdminActor } from "@/types";
import { recordAudit } from "@/services/auditService";

interface AuthValue {
  status: AuthStatus;
  user: User | null;
  isAdmin: boolean;
  configured: boolean;
  /** Resolves to whether the account has admin access. */
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  /** Force-refreshes the ID token (needed right after an admin claim is granted). */
  refreshAccess: () => Promise<boolean>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setStatus("signed-out");
      return;
    }
    return onAuthStateChanged(getFirebaseAuth(), async (u) => {
      if (!u) {
        setUser(null);
        setIsAdmin(false);
        setStatus("signed-out");
        return;
      }
      let admin = false;
      try {
        admin = (await u.getIdTokenResult()).claims.admin === true;
      } catch {
        admin = false;
      }
      setIsAdmin(admin);
      setUser(u);
      setStatus("signed-in");
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    const admin = (await cred.user.getIdTokenResult()).claims.admin === true;
    if (admin) {
      const actor = { uid: cred.user.uid, email: cred.user.email ?? email };
      recordAudit(actor, { action: "auth.login", targetType: "user", targetId: actor.uid, targetLabel: actor.email }).catch(() => undefined);
    }
    return admin;
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(getFirebaseAuth());
  }, []);

  const refreshAccess = useCallback(async () => {
    const current = getFirebaseAuth().currentUser;
    if (!current) return false;
    const admin = (await current.getIdTokenResult(true)).claims.admin === true;
    setIsAdmin(admin);
    return admin;
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ status, user, isAdmin, configured: isFirebaseConfigured, signIn, signOut, refreshAccess }),
    [status, user, isAdmin, signIn, signOut, refreshAccess],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** The signed-in admin, for stamping audit entries. Only call inside the guarded admin panel. */
export function useActor(): AdminActor {
  const { user } = useAuth();
  return useMemo(() => ({ uid: user?.uid ?? "", email: user?.email ?? "" }), [user]);
}
