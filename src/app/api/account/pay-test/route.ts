import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { applyPaymentEvent } from "@/lib/billing/payments";
import { adminDb, HttpError, rateLimit, readJson, requireUser, route } from "@/lib/firebase/admin";
import { findCustomerForUser } from "@/lib/account/server";
import { mapInvoice, type Data } from "@/lib/mappers";

export const dynamic = "force-dynamic";
const body = z.object({ invoiceId: z.string().min(1) });

/**
 * TEST-MODE ONLY. Pretends the customer's invoice was paid, going through exactly the same code as a real gateway
 * webhook. It is switched off unless BOTH PAYMENT_PROVIDER=mock and ALLOW_TEST_PAYMENTS=true are set, so a normal
 * production site can never hand out free licences through it. No money moves.
 */
export const POST = route(async (req) => {
  rateLimit(req, "account-paytest", 10);
  if ((process.env.PAYMENT_PROVIDER ?? "").toLowerCase() !== "mock" || process.env.ALLOW_TEST_PAYMENTS !== "true") {
    throw new HttpError(403, "Test payments are switched off.");
  }
  const user = await requireUser(req);
  const parsed = body.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, "Invalid request.");
  const db = adminDb();
  const customer = await findCustomerForUser(db, user);
  if (!customer) throw new HttpError(404, "No account found.");
  const snap = await db.collection("invoices").doc(parsed.data.invoiceId).get();
  if (!snap.exists || String(snap.data()?.customerId) !== customer.id) throw new HttpError(404, "Invoice not found.");
  const invoice = mapInvoice(snap.id, snap.data() as Data);
  if (invoice.status === "PAID" || invoice.status === "CANCELLED") throw new HttpError(409, `This invoice is already ${invoice.status.toLowerCase()}.`);
  const result = await applyPaymentEvent(db, { type: "payment.succeeded", reference: `test_${randomUUID()}`, invoiceId: invoice.id, amount: invoice.total, currency: "ZAR" }, "mock");
  return NextResponse.json({ ok: true, ...result });
});
