import { NextResponse } from "next/server";
import { GatewayError, getGateway } from "@/lib/billing/gateway";
import { applyPaymentEvent } from "@/lib/billing/payments";
import { adminDb, HttpError, rateLimit, route } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

/**
 * Payment gateway webhook. The signature is verified first; then the shared payment code checks the amount against
 * the invoice, uses the gateway reference as an idempotency key, and fulfils any paid purchase order (activates the
 * subscription and issues the licence).
 */
export const POST = route(async (req) => {
  rateLimit(req, "payment-webhook", 120);
  const raw = await req.text();
  let event;
  let provider;
  try {
    const gateway = getGateway();
    event = gateway.verifyAndParse(raw, req.headers);
    provider = gateway.name;
  } catch (e) {
    if (e instanceof GatewayError) throw new HttpError(e.status, e.message);
    throw e;
  }
  return NextResponse.json({ ok: true, ...(await applyPaymentEvent(adminDb(), event, provider)) });
});
