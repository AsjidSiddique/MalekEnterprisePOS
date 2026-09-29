import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Lets a customer see their own licence key again in their account, without the key ever sitting in the
 * database as plain text. The key is sealed with AES-256-GCM and stored in a server-only collection
 * (`licenseSecrets`, which no browser can read - see firestore.rules). It is only ever opened by a server route
 * after checking that the signed-in customer owns the licence.
 *
 * Key material: LICENSE_KEY_ENCRYPTION_SECRET if set, otherwise derived from the Firebase Admin private key that
 * already exists on the server. Set a dedicated secret in Vercel if you want to rotate the Admin key freely;
 * if the secret changes, older keys can't be opened any more and the admin just regenerates them.
 */
export function encryptionKey(env: NodeJS.ProcessEnv = process.env): Buffer | null {
  const secret = env.LICENSE_KEY_ENCRYPTION_SECRET || env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!secret) return null;
  return createHash("sha256").update(`malek-license-box:v1:${secret}`).digest();
}

const b64 = (b: Buffer) => b.toString("base64url");

export function sealToken(token: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return ["v1", b64(iv), b64(cipher.getAuthTag()), b64(enc)].join(".");
}

/** Returns null (never throws) when the value is malformed or was sealed with a different key. */
export function openToken(sealed: string, key: Buffer): string | null {
  try {
    const [v, iv, tag, data] = sealed.split(".");
    if (v !== "v1" || !iv || !tag || !data) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
