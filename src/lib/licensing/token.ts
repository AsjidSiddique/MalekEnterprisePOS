import { createHash, randomBytes } from "node:crypto";

/** Server-side only. 32 unambiguous characters (no 0/O, 1/I): 100 bits of entropy over 20 characters. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TOKEN_RE = /^MEP(-[A-Z2-9]{4}){5}$/;

export function generateLicenseToken(): string {
  const bytes = randomBytes(20);
  let raw = "";
  for (const b of bytes) raw += ALPHABET[b % ALPHABET.length];
  return `MEP-${raw.match(/.{4}/g)!.join("-")}`;
}

export function normalizeToken(token: string): string {
  return token.trim().toUpperCase();
}

export function isWellFormedToken(token: string): boolean {
  return TOKEN_RE.test(normalizeToken(token));
}

/** Only this hash is stored. The plaintext token is shown once, when it is generated. */
export function hashToken(token: string): string {
  return createHash("sha256").update(normalizeToken(token)).digest("hex");
}

/** Safe-to-display identifier, e.g. "MEP-ABCD". */
export function tokenPrefix(token: string): string {
  return normalizeToken(token).slice(0, 8);
}
