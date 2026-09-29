#!/usr/bin/env node
/**
 * Grants (or removes) the `admin` custom claim on an existing Firebase Auth user.
 *   npm run admin:grant -- you@example.com
 *   npm run admin:grant -- you@example.com --revoke
 * Reads FIREBASE_ADMIN_* from .env.local. The person must sign out and back in afterwards.
 */
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const [email, flag] = process.argv.slice(2);
if (!email || email.startsWith("--")) {
  console.error("Usage: npm run admin:grant -- <email> [--revoke]");
  process.exit(1);
}
const { FIREBASE_ADMIN_PROJECT_ID: projectId, FIREBASE_ADMIN_CLIENT_EMAIL: clientEmail, FIREBASE_ADMIN_PRIVATE_KEY: key } = process.env;
if (!projectId || !clientEmail || !key) {
  console.error("Missing FIREBASE_ADMIN_* variables. Add them to .env.local first (see SETUP.md).");
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey: key.replace(/\\n/g, "\n") }) });
const auth = getAuth();
try {
  const user = await auth.getUserByEmail(email);
  const revoke = flag === "--revoke";
  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), admin: revoke ? false : true });
  console.log(`${revoke ? "Removed admin access from" : "Granted admin access to"} ${email} (${user.uid}).`);
  if (!revoke) console.log("They must sign out and back in (or use 'Check again' on the access page) for it to take effect.");
} catch (e) {
  console.error(e.code === "auth/user-not-found" ? `No Firebase Auth user with email ${email}. Create the user in the Firebase console first.` : e.message);
  process.exit(1);
}
