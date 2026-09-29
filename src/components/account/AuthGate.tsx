"use client";

import { AlertCircle, Mail } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { useCustomerAuth } from "@/lib/account/useCustomerAuth";

const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "That email and password don't match. Check them, or use \"Forgot password\".",
  "auth/wrong-password": "That email and password don't match. Check them, or use \"Forgot password\".",
  "auth/user-not-found": "No account with that email yet. Switch to \"Create account\" below.",
  "auth/email-already-in-use": "That email already has an account. Switch to \"Sign in\" below.",
  "auth/weak-password": "Use at least 6 characters.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes, then try again.",
  "auth/network-request-failed": "Can't reach Firebase. Check your internet connection.",
  "auth/popup-closed-by-user": "The Google sign-in window was closed before finishing.",
  "auth/account-exists-with-different-credential": "That email already has a password-based account here. Sign in with your password instead - or contact support to link Google to it.",
};

/** Sign in / create account, shown when nobody is signed in yet. Deliberately plain - no plan, no price, just an account. */
export function AuthGate() {
  const auth = useCustomerAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const withGoogle = async () => {
    setError("");
    setGoogleBusy(true);
    try {
      await auth.signInWithGoogle();
    } catch (err) {
      setError(MESSAGES[(err as { code?: string }).code ?? ""] ?? "Couldn't sign in with Google. Try again.");
    } finally {
      setGoogleBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") { await auth.signUp(email.trim(), password); setSent(true); }
      else await auth.signIn(email.trim(), password);
    } catch (err) {
      setError(MESSAGES[(err as { code?: string }).code ?? ""] ?? (err instanceof Error ? err.message : "Something went wrong."));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="mx-auto max-w-md rounded-xl3 border border-line bg-surface p-8 text-center shadow-card">
        <Mail className="mx-auto mb-3 h-8 w-8 text-accent-strong" />
        <h2 className="font-display text-xl font-bold text-ink-900">Check your email</h2>
        <p className="mt-2 text-sm text-muted">We sent a verification link to <strong>{email}</strong>. Open it, then come back and sign in.</p>
        <Button className="mt-6" onClick={() => { setSent(false); setMode("signin"); }}>Go to sign in</Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-md space-y-5 rounded-xl3 border border-line bg-surface p-8 shadow-card">
      <button type="button" onClick={withGoogle} disabled={googleBusy}
        className="flex w-full items-center justify-center gap-3 rounded-field border border-line bg-white py-2.5 text-sm font-semibold text-ink-800 shadow-sm transition hover:bg-ink-50 disabled:opacity-60">
        <svg viewBox="0 0 48 48" className="h-4.5 w-4.5" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.6 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4c-7.6 0-14.2 4.3-17.7 10.7z" />
          <path fill="#4CAF50" d="M24 44c5.4 0 10.4-2.1 14.1-5.5l-6.5-5.5C29.5 34.9 26.9 36 24 36c-5.3 0-9.8-3.4-11.4-8.1l-6.6 5.1C9.7 39.6 16.3 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.5 5.5C41.5 36.4 44 30.7 44 24c0-1.3-.1-2.6-.4-3.5z" />
        </svg>
        Continue with Google
      </button>
      <div className="flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
      <div className="flex rounded-field bg-ink-100 p-1 text-sm font-semibold">
        {(["signin", "signup"] as const).map((m) => (
          <button key={m} type="button" onClick={() => { setMode(m); setError(""); }}
            className={`flex-1 rounded-[8px] py-2 transition ${mode === m ? "bg-white text-ink-900 shadow-sm" : "text-muted"}`}>
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>
      <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <TextField label="Password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="flex items-start gap-2 rounded-field bg-bad/10 p-3 text-sm text-[#A22B3B]"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
      <Button type="submit" size="lg" className="w-full" loading={busy}>{mode === "signup" ? "Create account" : "Sign in"}</Button>
      {mode === "signin" && (
        <button type="button" className="w-full text-center text-xs font-medium text-muted hover:text-ink-800"
          onClick={async () => { if (!email.trim()) return setError("Enter your email above first."); try { await auth.resetPassword(email.trim()); setError("Password reset email sent."); } catch { setError("Couldn't send that. Check the email address."); } }}>
          Forgot password?
        </button>
      )}
    </form>
  );
}
