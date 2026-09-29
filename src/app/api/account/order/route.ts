import { NextResponse } from "next/server";
import { adminDb, HttpError, rateLimit, readJson, requireUser, route } from "@/lib/firebase/admin";
import { createOrder } from "@/lib/account/server";
import { orderSchema } from "@/lib/account/order";

export const dynamic = "force-dynamic";

/** Creates the invoice for a plan purchase or upgrade. Pricing is always worked out here from Firestore, never trusted from the browser. */
export const POST = route(async (req) => {
  rateLimit(req, "account-order", 12);
  const user = await requireUser(req);
  const parsed = orderSchema.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request.");
  return NextResponse.json({ ok: true, ...(await createOrder(adminDb(), user, parsed.data)) });
});
