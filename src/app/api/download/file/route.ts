import { adminDb, HttpError, rateLimit, route } from "@/lib/firebase/admin";
import { deliverFile, getReleaseServer, pickFile } from "@/lib/releases/serve";
import { downloadSecret, verifyTicket } from "@/lib/releases/ticket";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // large linked files are streamed through here

export const GET = route(async (req) => {
  rateLimit(req, "dl-file", 30);
  const secret = downloadSecret();
  if (!secret) throw new HttpError(503, "Downloads aren't configured yet.");
  const ticket = verifyTicket(new URL(req.url).searchParams.get("t") ?? "", secret);
  if (!ticket) throw new HttpError(410, "This download link has expired. Go back to the download page and try again.");
  const db = adminDb();
  const release = await getReleaseServer(db, ticket.r);
  if (!release || release.status !== "published") throw new HttpError(404, "That release isn't available.");
  const file = pickFile(release, ticket.f);
  if (!file) throw new HttpError(404, "That file isn't available.");
  return deliverFile(req, db, release, file);
});
