"use client";

import { createUserWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase/client";

export type AuthStatus = "loading" | "signed-out" | "signed-in";

/** Auth state for the CUSTOMER portal. Deliberately separate from the admin's useAuth (@/components/admin/AuthProvider) -
 *  a customer must never be checked for the admin custom claim, and an admin signing in here would just be treated
 *  as an ordinary customer with no linked account. */
export function useCustomerAuth() {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) { setStatus("signed-out"); return; }
    return onAuthStateChanged(getFirebaseAuth(), (u) => {
      setUser(u);
      setStatus(u ? "signed-in" : "signed-out");
    });
  }, []);

  return {
    status, user, emailVerified: user?.emailVerified ?? false,
    signIn: (email: string, password: string) => signInWithEmailAndPassword(getFirebaseAuth(), email, password),
    // Google's own emailVerified is always true, so this account skips straight past VerifyEmailGate.
    // Requires the Google provider to be switched on in Firebase Console -> Authentication -> Sign-in method.
    signInWithGoogle: () => signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider()),
    signUp: async (email: string, password: string) => {
      const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
      await sendEmailVerification(cred.user);
      return cred;
    },
    resendVerification: () => { const u = getFirebaseAuth().currentUser; return u ? sendEmailVerification(u) : Promise.resolve(); },
    resetPassword: (email: string) => sendPasswordResetEmail(getFirebaseAuth(), email),
    signOut: () => signOut(getFirebaseAuth()),
    refreshToken: async () => { await getFirebaseAuth().currentUser?.getIdToken(true); },
  };
}
