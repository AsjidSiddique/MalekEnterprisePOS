import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";

/**
 * The server answers licence checks with a signed "lease": a JSON string plus an Ed25519 signature over
 * that exact string. The POS verifies it offline with the public key, so a tampered or forged response
 * (or a hand-edited local file) is rejected. Generate the key pair with `node scripts/generate-signing-key.mjs`.
 */
export const signingConfigured = () => Boolean(process.env.LICENSE_SIGNING_PRIVATE_KEY);

const loadKey = () => createPrivateKey({ key: (process.env.LICENSE_SIGNING_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"), format: "pem" });

export function signLease(payload: object): { lease: string; signature: string | null } {
  const lease = JSON.stringify(payload);
  if (!signingConfigured()) return { lease, signature: null };
  return { lease, signature: sign(null, Buffer.from(lease), loadKey()).toString("base64") };
}

export function verifyLease(lease: string, signature: string, publicKeyPem: string): boolean {
  try {
    return verify(null, Buffer.from(lease), createPublicKey(publicKeyPem), Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}
