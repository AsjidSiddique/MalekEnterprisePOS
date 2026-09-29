import { adminFetch } from "@/lib/api-client";
import type { BillingSummary } from "@/lib/billing/server-types";

export interface TeamMember { uid: string; email: string; name: string; lastSignIn: string | null; createdAt: string | null; isYou: boolean }

export const listAdmins = async () => (await adminFetch<{ admins: TeamMember[] }>("/api/admin/team", undefined, "GET")).admins;
export const inviteAdmin = (email: string) => adminFetch<{ ok: true; created: boolean; resetLink: string }>("/api/admin/team", { action: "invite", email });
export const revokeAdmin = (uid: string) => adminFetch<{ ok: true }>("/api/admin/team", { action: "revoke", uid });
export const runBillingNow = () => adminFetch<{ ok: true; summary: BillingSummary }>("/api/admin/billing/run", {});
