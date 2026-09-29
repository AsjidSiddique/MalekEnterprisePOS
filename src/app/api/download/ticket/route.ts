import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb, HttpError, rateLimit, readJson, route } from "@/lib/firebase/admin";
import { getReleaseServer, pickFile } from "@/lib/releases/serve";
import { downloadSecret, signTicket } from "@/lib/releases/ticket";

export const dynamic = "force-dynamic";

/** The public Download button calls this to get a link that works for five minutes. Only published releases qualify. */
export const POST = route(async (req) => {
  rateLimit(req, "dl-ticket", 20);
  const body = z.object({ releaseId: z.string().min(1).max(64), fileId: z.string().max(40).optional() }).safeParse(await readJson(req));
  if (!body.success) throw new HttpError(400, "releaseId is required.");
  const secret = downloadSecret();
  if (!secret) throw new HttpError(503, "Downloads aren't configured yet.");
  const release = await getReleaseServer(adminDb(), body.data.releaseId);
  if (!release || release.status !== "published") throw new HttpError(404, "That release isn't available.");
  const file = pickFile(release, body.data.fileId);
  if (!file) throw new HttpError(404, "That file isn't available.");
  return NextResponse.json({ url: `/api/download/file?t=${signTicket(release.id, file.id, secret)}`, fileName: file.name, expiresInSeconds: 300 }, { headers: { "Cache-Control": "no-store" } });
});
