/**
 * Server-side health checks behind /api/health. These run on the server, so they answer the question
 * the browser can't: "is the problem my network, or is the Firebase project itself not set up?"
 * Never returns secret values - only whether each one is present/valid, plus Google's own error text.
 */
import { withTimeout } from "@/lib/async";
import { FIRESTORE_DATABASE_ID } from "./databaseId";

export interface Check {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  /** What to do if `ok` is false. */
  fix?: string;
}

const clip = (s: string, n = 240) => (s.length > n ? `${s.slice(0, n)}...` : s);
const errText = (e: unknown) => clip(e instanceof Error ? e.message : String(e));

const PUBLIC_VARS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;
const ADMIN_VARS = ["FIREBASE_ADMIN_PROJECT_ID", "FIREBASE_ADMIN_CLIENT_EMAIL", "FIREBASE_ADMIN_PRIVATE_KEY"] as const;

export function checkEnv(env: Record<string, string | undefined>): Check[] {
  const missingPublic = PUBLIC_VARS.filter((k) => !env[k]?.trim());
  const missingAdmin = ADMIN_VARS.filter((k) => !env[k]?.trim());
  const checks: Check[] = [
    {
      id: "env-public",
      label: "Web app keys (NEXT_PUBLIC_FIREBASE_*)",
      ok: missingPublic.length === 0,
      detail: missingPublic.length ? `Missing or empty: ${missingPublic.join(", ")}` : "All six are set.",
      fix: missingPublic.length ? "Vercel > Settings > Environment Variables: add them, then Deployments > Redeploy (variables only apply to the next deploy)." : undefined,
    },
  ];

  const key = (env.FIREBASE_ADMIN_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  const keyLooksRight = key.includes("BEGIN PRIVATE KEY") && key.includes("END PRIVATE KEY");
  const idMismatch = Boolean(env.FIREBASE_ADMIN_PROJECT_ID && env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && env.FIREBASE_ADMIN_PROJECT_ID.trim() !== env.NEXT_PUBLIC_FIREBASE_PROJECT_ID.trim());
  const adminProblems = [
    ...(missingAdmin.length ? [`Missing or empty: ${missingAdmin.join(", ")}`] : []),
    ...(!missingAdmin.length && !keyLooksRight ? ["FIREBASE_ADMIN_PRIVATE_KEY doesn't look like a PEM key (it must contain BEGIN PRIVATE KEY ... END PRIVATE KEY)."] : []),
    ...(idMismatch ? ["FIREBASE_ADMIN_PROJECT_ID differs from NEXT_PUBLIC_FIREBASE_PROJECT_ID - the browser and the server are pointed at two different projects."] : []),
  ];
  checks.push({
    id: "env-admin",
    label: "Server credentials (FIREBASE_ADMIN_*)",
    ok: adminProblems.length === 0,
    detail: adminProblems.length ? adminProblems.join(" ") : "Present, key format looks valid, project IDs match.",
    fix: adminProblems.length ? "Re-paste the three values from the service-account JSON. Keep private_key in quotes with its \\n characters exactly as in the file." : undefined,
  });
  return checks;
}

/** Interprets the anonymous Firestore REST response. Pure, so it's unit-tested. */
export function classifyRest(status: number, body: string): Check {
  const base = { id: "firestore-public", label: "Firestore database reachable (public REST)" };
  const b = body.toLowerCase();
  if (status === 200) return { ...base, ok: true, detail: "Database exists and answered a public read." };
  if (status === 404 && (b.includes("database (default) does not exist") || b.includes("does not exist for project") || b.includes("datastore/setup"))) {
    return { ...base, ok: false, detail: `Google says the "${FIRESTORE_DATABASE_ID}" Firestore database does not exist for this project.`, fix: FIRESTORE_DATABASE_ID === "(default)" ? "Firebase console > Firestore Database > Create database > Production mode > pick a region. If your console already shows a database called plain default (no parentheses), it is a named database: set NEXT_PUBLIC_FIRESTORE_DATABASE_ID=default in Vercel and redeploy. This is the cause of \"client is offline\"." : "Check that NEXT_PUBLIC_FIRESTORE_DATABASE_ID matches the database name shown by firebase firestore:databases:list, then redeploy." };
  }
  if (status === 404) return { ...base, ok: true, detail: "Database exists (that particular document just hasn't been created yet - normal on a fresh project)." };
  if (status === 403 && (b.includes("has not been used") || b.includes("is disabled") || b.includes("service_disabled"))) {
    return { ...base, ok: false, detail: "The Cloud Firestore API is disabled for this project.", fix: "Google Cloud console > APIs & Services > Library > Cloud Firestore API > Enable." };
  }
  // Only blame the rules when Firestore itself says so. A bare 403 can also come from a proxy/WAF/firewall
  // between the server and Google, and guessing "rules" there would send you fixing the wrong thing.
  if (status === 403 && (b.includes("missing or insufficient permissions") || b.includes("permission_denied"))) {
    return { ...base, ok: false, detail: "Database exists but the security rules refuse public reads (rules not deployed yet, or still the locked default).", fix: "Run: firebase deploy --only firestore:rules,firestore:indexes" };
  }
  if (status === 403) return { ...base, ok: false, detail: `Got HTTP 403 that isn't a Firestore rules response, so something between the server and Google may be blocking the request. Response: ${clip(body, 200)}`, fix: "Check the API key's restrictions in Google Cloud > APIs & Services > Credentials, and any firewall/WAF in front of this deployment." };
  if (status === 400 && (b.includes("api key not valid") || b.includes("api_key_invalid"))) {
    return { ...base, ok: false, detail: "The API key was rejected.", fix: "Re-copy NEXT_PUBLIC_FIREBASE_API_KEY from Firebase > Project settings > Your apps, and check the key isn't restricted to other domains in Google Cloud > Credentials." };
  }
  return { ...base, ok: false, detail: `Unexpected response ${status}: ${clip(body, 200)}` };
}

/** Interprets an Admin-SDK Firestore/Auth error. Pure, so it's unit-tested. */
export function classifyAdminError(e: unknown, label: string, id: string): Check {
  const msg = errText(e);
  const m = msg.toLowerCase();
  const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "";
  const base = { id, label };
  if (e instanceof Error && e.name === "TimeoutError") return { ...base, ok: false, detail: msg, fix: "The server couldn't reach Google within 10 seconds - usually a wrong project ID or a missing database." };
  if (code === "5" || m.includes("not_found") || m.includes("does not exist")) {
    return { ...base, ok: false, detail: `Database not found: ${msg}`, fix: "Create the Firestore database (Firebase console > Firestore Database > Create database)." };
  }
  if (code === "7" || m.includes("permission_denied") || m.includes("permission denied")) {
    return { ...base, ok: false, detail: msg, fix: "The service account lacks access or the API is disabled. Generate a fresh key from THIS project (Project settings > Service accounts) and make sure the Firestore API is enabled." };
  }
  if (code === "16" || m.includes("invalid_grant") || m.includes("unauthenticated") || m.includes("invalid pem") || m.includes("private key") || m.includes("decoder")) {
    return { ...base, ok: false, detail: msg, fix: "The private key is malformed or belongs to another project. Re-paste FIREBASE_ADMIN_PRIVATE_KEY (in quotes, with the \\n characters intact) or generate a new key." };
  }
  return { ...base, ok: false, detail: msg };
}

async function restCheck(env: Record<string, string | undefined>): Promise<Check> {
  const project = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const key = env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!project || !key) return { id: "firestore-public", label: "Firestore database reachable (public REST)", ok: false, detail: "Skipped - web app keys are missing.", fix: "Fix the web app keys first." };
  try {
    const res = await withTimeout(fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/${encodeURIComponent(FIRESTORE_DATABASE_ID)}/documents/pricing/default?key=${key}`, { cache: "no-store" }), 8000, "Firestore REST check");
    return classifyRest(res.status, await res.text());
  } catch (e) {
    return { id: "firestore-public", label: "Firestore database reachable (public REST)", ok: false, detail: errText(e), fix: "The server couldn't reach firestore.googleapis.com." };
  }
}

async function adminChecks(): Promise<Check[]> {
  const out: Check[] = [];
  try {
    const { adminDb, adminAuth } = await import("@/lib/firebase/admin");
    try {
      await withTimeout(adminDb().collection("settings").limit(1).get(), 10000, "Firestore admin read");
      out.push({ id: "firestore-admin", label: "Firestore via server credentials", ok: true, detail: "Server can read the database." });
    } catch (e) {
      out.push(classifyAdminError(e, "Firestore via server credentials", "firestore-admin"));
    }
    try {
      const list = await withTimeout(adminAuth().listUsers(200), 10000, "Auth admin read");
      const admins = list.users.filter((u) => u.customClaims?.admin === true).length;
      out.push({
        id: "admin-user",
        label: "Admin account",
        ok: admins > 0,
        detail: `${list.users.length} user(s) exist, ${admins} with admin access.`,
        fix: admins > 0 ? undefined : list.users.length ? "Run: npm run admin:grant -- you@example.com (creating the user alone doesn't grant admin)." : "Create a user in Firebase > Authentication > Users, then run npm run admin:grant -- you@example.com",
      });
    } catch (e) {
      out.push(classifyAdminError(e, "Admin account", "admin-user"));
    }
  } catch (e) {
    out.push(classifyAdminError(e, "Server credentials", "firestore-admin"));
  }
  return out;
}

export async function runDiagnostics(env: Record<string, string | undefined> = process.env) {
  const envChecks = checkEnv(env);
  const adminEnvOk = envChecks.find((c) => c.id === "env-admin")?.ok;
  const [rest, admin] = await Promise.all([restCheck(env), adminEnvOk ? adminChecks() : Promise.resolve<Check[]>([])]);
  const checks = [...envChecks, rest, ...admin];
  return {
    ok: checks.every((c) => c.ok),
    checkedAt: new Date().toISOString(),
    deployment: {
      environment: env.VERCEL_ENV ?? "local",
      commit: (env.VERCEL_GIT_COMMIT_SHA ?? "unknown").slice(0, 7),
      region: env.VERCEL_REGION ?? "unknown",
    },
    checks,
  };
}
