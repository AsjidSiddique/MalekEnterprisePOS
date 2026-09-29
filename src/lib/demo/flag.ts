/** True only in demo builds (NEXT_PUBLIC_DEMO_MODE=true). Inlined at build time, so production bundles never contain demo code paths. */
export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
