"use client";

import { MailCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useCustomerAuth } from "@/lib/account/useCustomerAuth";

/** Blocks the portal (but not sign-out) until the email is verified - buying a plan needs a real, reachable email. */
export function VerifyEmailGate({ email }: { email: string }) {
  const auth = useCustomerAuth();
  const [sent, setSent] = useState(false);
  const [checking, setChecking] = useState(false);
  return (
    <div className="mx-auto max-w-md rounded-xl3 border border-line bg-surface p-8 text-center shadow-card">
      <MailCheck className="mx-auto mb-3 h-8 w-8 text-accent-strong" />
      <h2 className="font-display text-xl font-bold text-ink-900">Verify your email</h2>
      <p className="mt-2 text-sm text-muted">Confirm <strong>{email}</strong> to buy a plan and see your licence. Check your inbox for the link we sent when you signed up.</p>      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button variant="secondary" loading={checking} onClick={async () => { setChecking(true); await auth.refreshToken(); setChecking(false); }}>I&apos;ve verified it</Button>
        <Button variant="ghost" disabled={sent} onClick={async () => { await auth.resendVerification(); setSent(true); }}>{sent ? "Sent" : "Resend email"}</Button>
      </div>
    </div>
  );
}
