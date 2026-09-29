"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";
import { FIRESTORE_DATABASE_ID } from "./databaseId";
import { getStorage, type FirebaseStorage } from "firebase/storage";

export class FirebaseNotConfiguredError extends Error {
  constructor() {
    super("Firebase isn't configured yet. Copy .env.example to .env.local and add your web app keys (see SETUP.md).");
    this.name = "FirebaseNotConfiguredError";
  }
}


const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const demo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
export const isFirebaseConfigured = demo || Boolean(config.apiKey && config.projectId && config.appId && config.authDomain);

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured) {
    // Print exactly which of the six required values are missing, once, the first time anything
    // tries to use Firebase. Previously this only surfaced as a generic thrown error with no detail -
    // now it names the specific env var(s) that are empty, which is normally the actual root cause
    // of "everything's stuck loading" (a value that's missing or was set in Vercel but never
    // redeployed), not a real network/connectivity problem.
    const missing = Object.entries(config).filter(([, v]) => !v).map(([k]) => k);
    console.error(`[firebase] Not configured - missing: ${missing.join(", ") || "(demo mode is also off)"}. Check Vercel's Environment Variables and confirm a Redeploy happened after adding them.`);
    throw new FirebaseNotConfiguredError();
  }
  if (getApps().length === 0) {
    // Printed once per page load, only in the browser console (never sent anywhere) - lets you
    // confirm at a glance that the LIVE site really is using the project you think it is, without
    // ever printing the API key itself (that value is safe to be public per Firebase's own docs, but
    // there's no reason to echo it back regardless).
    console.log(`[firebase] Initializing project "${config.projectId}" (authDomain: ${config.authDomain})`);
  }
  return getApps().length ? getApp() : initializeApp(config);
}

export const getFirebaseAuth = (): Auth => getAuth(getFirebaseApp());
export const getFirebaseStorage = (): FirebaseStorage => getStorage(getFirebaseApp());

let db: Firestore | undefined;
export function getDb(): Firestore {
  if (db) return db;
  const app = getFirebaseApp();
  try {
    // "Failed to get document because the client is offline" while other sites work has two causes:
    //   1. The Firestore database was never created in the Firebase console (the server-side check at
    //      /api/health reports this directly), or
    //   2. The network/antivirus/proxy breaks Firestore's default streaming (WebChannel) connection.
    // For (2) we force plain long-polling HTTP, which every proxy handles. (Auto-detect was tried first, but it
    // only probes once at startup and can guess wrong; the admin panel doesn't use realtime listeners, so the
    // small latency cost of long-polling is irrelevant here.) This cannot fix (1) - only creating the database can.
    db = initializeFirestore(app, { ignoreUndefinedProperties: true, experimentalForceLongPolling: true }, FIRESTORE_DATABASE_ID);
    console.log(`[firebase] Firestore ready (long-polling transport, database "${FIRESTORE_DATABASE_ID}")`);
  } catch (e) {
    // initializeFirestore throws if Firestore was already initialised for this app (e.g. Fast Refresh).
    console.warn("[firebase] Firestore already initialised, reusing the existing instance:", e instanceof Error ? e.message : e);
    db = getFirestore(app, FIRESTORE_DATABASE_ID);
  }
  return db;
}
