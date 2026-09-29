/**
 * Which Firestore database this site talks to.
 *
 * Firestore's standard database is literally named "(default)" (with the parentheses), and that is what every
 * Firebase SDK connects to unless told otherwise. A project can also hold *named* databases. If the database in
 * your Firebase console shows up as plain `default` (no parentheses) - e.g. `firebase firestore:databases:list`
 * prints `projects/<id>/databases/default` - it is a named database, and the SDKs will NOT find it unless
 * they are given that name. That mismatch is what produced "client is offline", NOT_FOUND and the contact form
 * timing out.
 *
 * Set NEXT_PUBLIC_FIRESTORE_DATABASE_ID=default in Vercel (and .env.local) to use it. Leave it unset for a normal
 * "(default)" database. It is NEXT_PUBLIC_ because the browser needs it too; a database name is not a secret.
 * The same value is used by the browser SDK, the server (Admin SDK), the public REST reads and /api/health.
 */
export const FIRESTORE_DATABASE_ID: string = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID?.trim() || "(default)";
