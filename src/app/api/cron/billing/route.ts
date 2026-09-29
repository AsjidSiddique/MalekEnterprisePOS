import { NextResponse } from "next/server";
import { adminDb, requireCronSecret, route } from "@/lib/firebase/admin";
import { runBillingJob } from "@/lib/billing/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel Cron calls this daily (see vercel.json) with `Authorization: Bearer $CRON_SECRET`. */
const handler = route(async (req) => {
  requireCronSecret(req);
  const summary = await runBillingJob(adminDb());
  return NextResponse.json({ ok: true, summary });
});

export const GET = handler;
export const POST = handler;
