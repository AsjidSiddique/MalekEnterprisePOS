"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/admin/AuthProvider";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Logo } from "@/components/ui/Logo";
import { ReceiptStub } from "@/components/marketing/ReceiptStub";
import { isDemoMode } from "@/lib/demo/flag";

const messages: Record<string, string> = {
  "auth/invalid-credential": "That email and password don't match. Check them and try again.",
  "auth/wrong-password": "That email and password don't match. Check them and try again.",
  "auth/user-not-found": "That email and password don't match. Check them and try again.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes, then try again.",
  "auth/network-request-failed": "Can't reach Firebase. Check your internet connection.",
  "auth/user-disabled": "This account has been disabled.",
};

const safeNext = (value: string | null) => (value && value.startsWith("/admin") && !value.startsWith("//") ? value : "/admin");

export default function AdminLoginPage() {
  const router = useRouter();
  const { status, isAdmin, signIn, configured } = useAuth();
  const [email, setEmail] = useState(isDemoMode ? "admin@malek.example" : "");
  const [password, setPassword] = useState(isDemoMode ? "demo-password" : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "signed-in" && isAdmin) router.replace(safeNext(new URLSearchParams(window.location.search).get("next")));
  }, [status, isAdmin, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const admin = await signIn(email.trim(), password);
      router.replace(admin ? safeNext(new URLSearchParams(window.location.search).get("next")) : "/admin/unauthorized");
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      setError(messages[code] ?? (err instanceof Error && err.name === "FirebaseNotConfiguredError" ? err.message : "Couldn't sign you in. Try again."));
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-ink-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="bg-dots absolute inset-0" />
        <div aria-hidden className="absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-ink-600/40 blur-[110px]" />
        <Logo tone="light" className="relative" />
        <div className="relative max-w-md">
          <h1 className="display text-[64px] text-balance">Run the business from one place.</h1>
          <p className="mt-6 text-lg text-ink-200">Customers, billing, licences and releases, with every change in the audit log.</p>
          <ul className="mt-8 space-y-3 text-[15px] text-ink-100">
            {["Mark payments and watch licences follow", "Publish installers with private, expiring links", "Unlink a stolen till in one click"].map((t) => <li key={t} className="flex items-center gap-3"><span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />{t}</li>)}
          </ul>
        </div>
        <ReceiptStub className="absolute -right-8 bottom-12 hidden w-64 rotate-[5deg] xl:block" />
        <p className="relative text-xs text-ink-300">Restricted to authorised administrators.</p>
      </div>

      <div className="flex items-center justify-center bg-paper px-6 py-12">
        <div className="w-full max-w-sm">
          <Logo className="mb-10 lg:hidden" />
          <h2 className="display-wide text-3xl font-bold">Sign in to admin</h2>
          <p className="mt-1 text-sm text-muted">Use the email and password for your admin account.</p>

          {isDemoMode && (
            <div role="note" className="mt-6 rounded-2xl bg-accent/25 p-4 text-sm text-[#5A3A00] ring-1 ring-accent-strong/30"><b>Demo mode.</b> Everything here is sample data and nothing is saved. Any password works.</div>
          )}
          {!configured && (
            <div role="alert" className="mt-6 flex gap-3 rounded-panel border border-warn/40 bg-warn/10 p-3 text-sm text-[#6B4300]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>Firebase isn&apos;t configured on this deployment yet. Add your web app keys to <code className="font-receipt text-xs">.env.local</code> — see SETUP.md.</p>
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <TextField label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <p role="alert" className="rounded-field bg-bad/10 px-3 py-2 text-sm text-[#A22B3B]">{error}</p>}
            <Button type="submit" variant="dark" size="lg" className="w-full" loading={busy} disabled={!email || !password || !configured}>Sign in</Button>
          </form>

          <Link href="/" className="mt-8 inline-block text-sm text-muted underline-offset-4 hover:text-ink-900 hover:underline">Back to the public site</Link>
        </div>
      </div>
    </div>
  );
}
