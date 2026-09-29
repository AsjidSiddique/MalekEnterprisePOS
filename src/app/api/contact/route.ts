import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, HttpError, rateLimit, readJson, route } from "@/lib/firebase/admin";
import { withTimeout } from "@/lib/async";
import { inquirySchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/**
 * Contact form submissions. Written by the server (Admin SDK) instead of from the visitor's browser,
 * so a visitor whose network blocks Firestore's browser connection can still reach us, and the write
 * has a hard timeout instead of hanging forever.
 */
export const POST = route(async (req) => {
  rateLimit(req, "contact", 5, 10 * 60_000);
  const body = await readJson<Record<string, unknown>>(req);
  if (typeof body.website === "string" && body.website.trim()) return NextResponse.json({ ok: true }); // honeypot: pretend success to bots

  const parsed = inquirySchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Please check the form and try again.");

  try {
    await withTimeout(adminDb().collection("inquiries").add({ ...parsed.data, createdAt: FieldValue.serverTimestamp() }), 10_000, "Saving the message");
  } catch (e) {
    if (e instanceof HttpError) throw e; // e.g. 503 when server credentials aren't configured - the form then falls back
    console.error("[contact] could not save inquiry:", e);
    throw new HttpError(503, "Message storage isn't available right now.");
  }
  console.log("[contact] inquiry stored");
  return NextResponse.json({ ok: true });
});
