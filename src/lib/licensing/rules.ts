import type { LicenseState, LicenseStatus, SubscriptionStatus } from "@/types";
import { addDays, daysBetween } from "@/lib/dates";

export interface LicenseFacts {
  status: LicenseStatus;
  revoked: boolean;
  expiryDate: string;
  gracePeriodDays: number;
}

/**
 * The effective state combines the licence record with the customer's subscription standing.
 * ACTIVE and GRACE both allow the POS to operate; GRACE means "works, but show a payment warning".
 */
export function computeLicenseState(
  license: LicenseFacts,
  subscriptionStatus: SubscriptionStatus | null,
  today: string,
): LicenseState {
  if (license.revoked || license.status === "REVOKED") return "REVOKED";
  if (subscriptionStatus === "SUSPENDED" || subscriptionStatus === "CANCELLED") return "SUSPENDED";
  if (license.expiryDate < today) {
    return daysBetween(license.expiryDate, today) <= license.gracePeriodDays ? "GRACE" : "EXPIRED";
  }
  if (subscriptionStatus === "OVERDUE" || subscriptionStatus === "GRACE") return "GRACE";
  return "ACTIVE";
}

export const isOperational = (state: LicenseState) => state === "ACTIVE" || state === "GRACE";

export interface RegisterCheck {
  state: LicenseState;
  terminalLimit: number;
  activeTerminals: number;
  /** True when this exact device is already registered and active (re-registering is a no-op). */
  alreadyActive: boolean;
}

export function canRegisterTerminal(c: RegisterCheck): { ok: boolean; reason?: string } {
  if (!isOperational(c.state)) return { ok: false, reason: `This licence is ${c.state.toLowerCase()}.` };
  if (c.alreadyActive) return { ok: true };
  if (c.activeTerminals >= c.terminalLimit) {
    return { ok: false, reason: `Terminal limit reached (${c.activeTerminals} of ${c.terminalLimit} in use).` };
  }
  return { ok: true };
}

/** A paid-up subscription keeps its licence valid through the next billing date plus the grace period. */
export function renewedExpiry(current: string, nextBillingDate: string, gracePeriodDays: number): string {
  const target = addDays(nextBillingDate, gracePeriodDays);
  return target > current ? target : current;
}
