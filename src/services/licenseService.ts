import type { License, LicenseState, Subscription, Terminal } from "@/types";
import { mapLicense } from "@/lib/mappers";
import { computeLicenseState } from "@/lib/licensing/rules";
import { todayISO } from "@/lib/dates";
import { adminFetch } from "@/lib/api-client";
import { listDocs, newestFirst, whereEq } from "./base";

export const listLicenses = (): Promise<License[]> => listDocs("licenses", mapLicense, ...newestFirst());
export const listLicensesForCustomer = (customerId: string): Promise<License[]> =>
  listDocs("licenses", mapLicense, whereEq("customerId", customerId));

export function effectiveState(license: License, subscription: Subscription | undefined): LicenseState {
  return computeLicenseState(license, subscription?.status ?? null, todayISO());
}

export function activeTerminalCount(licenseId: string, terminals: Terminal[]): number {
  return terminals.filter((t) => t.licenseId === licenseId && t.status === "ACTIVE").length;
}

export interface LicenseActionResult {
  ok: true;
  licenseId: string;
  /** Present only when a new token was generated. It is shown once and never stored in plain text. */
  token?: string;
}

type LicenseCommand =
  | { action: "generate"; customerId: string; subscriptionId?: string; expiryDate?: string }
  | { action: "regenerate" | "revoke" | "reactivate"; licenseId: string }
  | { action: "extend"; licenseId: string; expiryDate: string };

/** All licence mutations run on the server (Admin SDK) so tokens are generated and hashed there. */
export const runLicenseCommand = (cmd: LicenseCommand) => adminFetch<LicenseActionResult>("/api/admin/licenses", cmd);
