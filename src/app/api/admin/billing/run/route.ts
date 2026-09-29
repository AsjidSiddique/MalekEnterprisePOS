import { NextResponse } from "next/server";
import { runBillingJob } from "@/lib/billing/server";
import { adminDb, rateLimit, requireAdmin, route } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** The same job the daily cron runs, started by an admin from the panel. Safe to run any time: it never bills a cycle twice. */
export const POST = route(async (req) => {
  await requireAdmin(req);
  rateLimit(req, "billing-run", 5);
  return NextResponse.json({ ok: true, summary: await runBillingJob(adminDb()) });
});
