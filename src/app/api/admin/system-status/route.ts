import { NextResponse } from "next/server";
import { requireAdmin, route } from "@/lib/firebase/admin";
import { signingConfigured } from "@/lib/licensing/lease";
import { downloadSecret } from "@/lib/releases/ticket";
import { emailConfigured } from "@/lib/notifications/email";

export const dynamic = "force-dynamic";

/** Reports which integrations are configured (never their values) so the admin knows what still needs setting up. */
export const GET = route(async (req) => {
  await requireAdmin(req);
  const provider = (process.env.PAYMENT_PROVIDER ?? "").toLowerCase();
  const checks = [
    { id: "server", label: "Server credentials", ok: true, detail: "Connected. Licence and notification actions can run." },
    { id: "cron", label: "Daily billing job", ok: Boolean(process.env.CRON_SECRET), detail: process.env.CRON_SECRET ? "CRON_SECRET is set. Vercel runs /api/cron/billing daily at 04:00 UTC." : "Set CRON_SECRET so the daily job (invoices, overdue flags, reminders) can run." },
    { id: "signing", label: "Licence signing key", ok: signingConfigured(), detail: signingConfigured() ? "Licence responses are signed so the POS can verify them offline." : "Run scripts/generate-signing-key.mjs and set LICENSE_SIGNING_PRIVATE_KEY. Until then licence responses are unsigned." },
    { id: "downloads", label: "Secure downloads", ok: Boolean(downloadSecret()), detail: downloadSecret() ? `Download links are signed and expire after five minutes.${process.env.GITHUB_TOKEN ? " A GitHub token is set, so private repository releases can be used." : ""}` : "Set DOWNLOAD_SIGNING_SECRET (any long random string) so visitors can download. Until then the Download button shows an error." },
    { id: "payments", label: "Payment gateway", ok: provider === "mock" && Boolean(process.env.PAYMENT_WEBHOOK_SECRET), detail: provider === "yoco" ? "Yoco is selected but not implemented yet. Payments are recorded manually." : provider === "mock" ? (process.env.PAYMENT_WEBHOOK_SECRET ? "Test mode: the mock gateway accepts signed test events." : "Mock gateway selected but PAYMENT_WEBHOOK_SECRET is missing.") : "No gateway connected. Cash and bank payments are recorded with Mark as paid." },
    { id: "email", label: "Email delivery", ok: emailConfigured(), detail: emailConfigured() ? "Resend is configured. Use Send now on a queued email." : "Add RESEND_API_KEY and EMAIL_FROM once the sending domain is verified. Notifications are queued until then." },
  ];
  return NextResponse.json({ checks });
});
