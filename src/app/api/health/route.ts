import { NextResponse } from "next/server";
import { rateLimit, route } from "@/lib/firebase/admin";
import { runDiagnostics } from "@/lib/firebase/diagnose";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Open in a browser: /api/health
 * Shows, from the server's point of view, whether Firebase is configured and reachable - which is how
 * you tell "the Firestore database was never created" apart from "something is wrong with this browser".
 * Returns only pass/fail and Google's own error text - never any secret value.
 */
export const GET = route(async (req) => {
  rateLimit(req, "health", 20);
  const result = await runDiagnostics();
  console.log(`[health] ok=${result.ok} ${result.checks.filter((c) => !c.ok).map((c) => c.id).join(",") || "all-passed"}`);
  return new NextResponse(JSON.stringify(result, null, 2), {
    status: result.ok ? 200 : 503,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
});
