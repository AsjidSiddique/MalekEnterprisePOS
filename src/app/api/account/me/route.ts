import { NextResponse } from "next/server";
import { adminDb, rateLimit, requireUser, route } from "@/lib/firebase/admin";
import { loadPortal } from "@/lib/account/server";

export const dynamic = "force-dynamic";

/** Everything the signed-in customer's account page needs. Only ever returns the caller's own data. */
export const GET = route(async (req) => {
  rateLimit(req, "account-me", 60);
  const user = await requireUser(req);
  return NextResponse.json(await loadPortal(adminDb(), user));
});
