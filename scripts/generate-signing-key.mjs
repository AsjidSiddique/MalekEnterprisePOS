#!/usr/bin/env node
/** Prints an Ed25519 key pair for signing licence leases. Keep the private key secret; embed the public key in the POS. */
import { generateKeyPairSync } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const priv = privateKey.export({ type: "pkcs8", format: "pem" }).toString().trim();
const pub = publicKey.export({ type: "spki", format: "pem" }).toString().trim();

console.log("# Add this to .env.local / your host's environment variables (server only):\n");
console.log(`LICENSE_SIGNING_PRIVATE_KEY="${priv.replace(/\n/g, "\\n")}"\n`);
console.log("# Embed this public key in the POS so it can verify lease signatures offline:\n");
console.log(pub);
