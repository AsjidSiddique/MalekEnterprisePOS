import { FieldValue } from "firebase-admin/firestore";
import { adminDb, HttpError, rateLimit } from "@/lib/firebase/admin";
import { deliverFile, getReleaseServer, isFreshDownload, pickFile } from "@/lib/releases/serve";
import { hashShareToken } from "@/lib/releases/ticket";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const page = (status: number, title: string, text: string) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0c1a3d;color:#fff;font-family:system-ui,sans-serif;padding:24px">
<main style="max-width:420px"><h1 style="font-size:24px;margin:0 0 8px">${title}</h1><p style="color:#b7c2dc;line-height:1.5;margin:0">${text}</p></main></body>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );

/** A private, expiring download link created by an admin. Works for drafts and archived builds too, and can be revoked. */
export async function GET(req: Request): Promise<Response> {
  try {
    rateLimit(req, "share-get", 30);
    const token = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
    if (token.length < 20 || token.length > 80) return page(404, "Link not found", "Check that you copied the whole link.");
    const db = adminDb();
    const ref = db.collection("shareLinks").doc(hashShareToken(token));
    const fresh = isFreshDownload(req);

    const link = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpError(404, "not_found");
      const d = snap.data() ?? {};
      const expires = d.expiresAt?.toMillis?.() as number | undefined;
      if (d.revoked === true) throw new HttpError(410, "revoked");
      if (expires && expires < Date.now()) throw new HttpError(410, "expired");
      if (fresh) {
        if (Number(d.uses ?? 0) >= Number(d.maxUses ?? 1)) throw new HttpError(410, "used");
        tx.update(ref, { uses: FieldValue.increment(1), lastUsedAt: FieldValue.serverTimestamp() });
      }
      return { releaseId: String(d.releaseId), fileId: String(d.fileId) };
    });

    const release = await getReleaseServer(db, link.releaseId);
    const file = release && pickFile(release, link.fileId);
    if (!release || !file) return page(404, "File no longer available", "This release was removed. Ask the sender for a new link.");
    return await deliverFile(req, db, release, file, { count: true });
  } catch (e) {
    if (e instanceof HttpError) {
      const copy: Record<string, [string, string]> = {
        not_found: ["Link not found", "Check that you copied the whole link."],
        revoked: ["This link was cancelled", "The sender turned this link off. Ask them for a new one."],
        expired: ["This link has expired", "Ask the sender for a new one."],
        used: ["This link has been used up", "It only works a limited number of times. Ask the sender for a new one."],
      };
      const [title, text] = copy[e.message] ?? ["Download unavailable", e.message];
      return page(e.status, title, text);
    }
    console.error("[share]", e);
    return page(500, "Something went wrong", "Please try again in a moment.");
  }
}
