import { describe, expect, it } from "vitest";
import { addMonths, daysBetween } from "@/lib/dates";
import { calcTotals, checkTransition, invoiceNumber } from "@/lib/billing/invoiceRules";
import { advanceBillingDate, cycleAmount, deriveSubscriptionStatus, isReminderDue, shouldMarkOverdue } from "@/lib/billing/lifecycle";
import { generateLicenseToken, hashToken, isWellFormedToken, tokenPrefix } from "@/lib/licensing/token";
import { canRegisterTerminal, computeLicenseState, renewedExpiry } from "@/lib/licensing/rules";
import { compareVersions, evaluatePublish, pickLatest } from "@/lib/releases/rules";
import { resolveAdminAccess } from "@/lib/auth/access";
import { customerSchema, markPaidSchema, releaseSchema, subscriptionSchema } from "@/lib/validation/schemas";

describe("dates", () => {
  it("clamps month ends", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-11-27", 3)).toBe("2027-02-27");
  });
  it("counts days", () => expect(daysBetween("2026-09-27", "2026-10-02")).toBe(5));
});

describe("invoice status changes", () => {
  it("allows paying a pending or overdue invoice", () => {
    expect(checkTransition("PENDING", "PAID")).toEqual({ ok: true, requiresConfirmation: false });
    expect(checkTransition("OVERDUE", "PAID").ok).toBe(true);
  });
  it("needs confirmation to pay a cancelled invoice", () => {
    expect(checkTransition("CANCELLED", "PAID")).toMatchObject({ ok: true, requiresConfirmation: true });
  });
  it("needs confirmation to un-pay, and blocks nonsense moves", () => {
    expect(checkTransition("PAID", "PENDING")).toMatchObject({ ok: true, requiresConfirmation: true });
    expect(checkTransition("PAID", "OVERDUE").ok).toBe(false);
    expect(checkTransition("PAID", "PAID").ok).toBe(false);
  });
  it("calculates VAT totals", () => {
    const t = calcTotals([{ description: "Terminals", quantity: 3, unitPrice: 350 }], 0.15);
    expect(t).toEqual({ subtotal: 1050, vatAmount: 157.5, total: 1207.5 });
  });
  it("formats invoice numbers", () => expect(invoiceNumber("INV", "2026-09-27", 7)).toBe("INV-202609-0007"));
});

describe("manual payment marking", () => {
  it("accepts every supported method", () => {
    for (const method of ["online", "cash", "bank_transfer", "manual", "other"]) {
      expect(markPaidSchema.safeParse({ method, note: "" }).success).toBe(true);
    }
  });
  it("rejects unknown methods", () => expect(markPaidSchema.safeParse({ method: "crypto" }).success).toBe(false));
});

describe("billing lifecycle", () => {
  it("multiplies price by cycle length", () => {
    expect(cycleAmount(10, 350, "monthly")).toBe(3500);
    expect(cycleAmount(2, 500, "quarterly")).toBe(3000);
    expect(advanceBillingDate("2026-09-27", "monthly")).toBe("2026-10-27");
  });
  it("moves through pending → overdue → suspended → active", () => {
    const base = { current: "PENDING" as const, graceDays: 5 };
    const inv = (status: "PENDING" | "PAID", dueDate: string) => ({ status, dueDate });
    expect(deriveSubscriptionStatus({ ...base, invoices: [inv("PENDING", "2026-09-27")], today: "2026-09-25" })).toBe("PENDING");
    expect(deriveSubscriptionStatus({ ...base, invoices: [inv("PENDING", "2026-09-27")], today: "2026-10-02" })).toBe("OVERDUE");
    expect(deriveSubscriptionStatus({ ...base, invoices: [inv("PENDING", "2026-09-27")], today: "2026-10-03" })).toBe("SUSPENDED");
    expect(deriveSubscriptionStatus({ ...base, current: "SUSPENDED", invoices: [inv("PAID", "2026-09-27")], today: "2026-10-03" })).toBe("ACTIVE");
  });
  it("leaves brand-new subscriptions and cancelled ones alone", () => {
    expect(deriveSubscriptionStatus({ current: "PENDING", invoices: [], graceDays: 5, today: "2026-09-01" })).toBe("PENDING");
    expect(deriveSubscriptionStatus({ current: "CANCELLED", invoices: [{ status: "PAID", dueDate: "2026-01-01" }], graceDays: 5, today: "2026-09-01" })).toBe("CANCELLED");
  });
  it("flags overdue invoices and reminders", () => {
    expect(shouldMarkOverdue({ status: "PENDING", dueDate: "2026-09-27" }, "2026-09-28")).toBe(true);
    expect(shouldMarkOverdue({ status: "PAID", dueDate: "2026-09-27" }, "2026-09-28")).toBe(false);
    expect(isReminderDue({ status: "PENDING", dueDate: "2026-09-27" }, "2026-09-24", 3)).toBe(true);
  });
});

describe("licence tokens", () => {
  it("generates well-formed, unique tokens and stores only hashes", () => {
    const a = generateLicenseToken();
    const b = generateLicenseToken();
    expect(isWellFormedToken(a)).toBe(true);
    expect(a).not.toBe(b);
    expect(hashToken(a)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(a.toLowerCase())).toBe(hashToken(a));
    expect(tokenPrefix(a)).toHaveLength(8);
  });
  it("rejects malformed tokens", () => expect(isWellFormedToken("hello")).toBe(false));
});

describe("licence state and revocation", () => {
  const lic = { status: "ACTIVE" as const, revoked: false, expiryDate: "2026-10-31", gracePeriodDays: 5 };
  it("is active while paid up", () => expect(computeLicenseState(lic, "ACTIVE", "2026-09-20")).toBe("ACTIVE"));
  it("revocation wins over everything", () => {
    expect(computeLicenseState({ ...lic, revoked: true }, "ACTIVE", "2026-09-20")).toBe("REVOKED");
    expect(computeLicenseState({ ...lic, status: "REVOKED" }, "ACTIVE", "2026-09-20")).toBe("REVOKED");
  });
  it("suspends with the subscription and warns while overdue", () => {
    expect(computeLicenseState(lic, "SUSPENDED", "2026-09-20")).toBe("SUSPENDED");
    expect(computeLicenseState(lic, "OVERDUE", "2026-09-20")).toBe("GRACE");
  });
  it("uses the grace period after expiry", () => {
    expect(computeLicenseState(lic, "ACTIVE", "2026-11-04")).toBe("GRACE");
    expect(computeLicenseState(lic, "ACTIVE", "2026-11-06")).toBe("EXPIRED");
  });
  it("only ever extends expiry", () => {
    expect(renewedExpiry("2026-10-31", "2026-11-27", 5)).toBe("2026-12-02");
    expect(renewedExpiry("2027-01-31", "2026-11-27", 5)).toBe("2027-01-31");
  });
});

describe("terminal limit validation", () => {
  const base = { state: "ACTIVE" as const, terminalLimit: 2, activeTerminals: 1, alreadyActive: false };
  it("allows registration under the limit", () => expect(canRegisterTerminal(base).ok).toBe(true));
  it("blocks registration at the limit", () => {
    const r = canRegisterTerminal({ ...base, activeTerminals: 2 });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("2 of 2");
  });
  it("lets an already-registered device re-register at the limit", () => {
    expect(canRegisterTerminal({ ...base, activeTerminals: 2, alreadyActive: true }).ok).toBe(true);
  });
  it("blocks non-operational licences", () => {
    expect(canRegisterTerminal({ ...base, state: "REVOKED" }).ok).toBe(false);
    expect(canRegisterTerminal({ ...base, state: "SUSPENDED" }).ok).toBe(false);
  });
});

describe("release publishing", () => {
  const installer = [{ kind: "installer" as const }];
  const others = [{ id: "a", version: "1.0.0", status: "published" as const }];
  it("requires an installer", () => expect(evaluatePublish({ version: "1.1.0", files: [] }, others).ok).toBe(false));
  it("rejects duplicate versions", () => {
    expect(evaluatePublish({ id: "b", version: "1.0.0", files: installer }, others).ok).toBe(false);
    expect(evaluatePublish({ id: "a", version: "1.0.0", files: installer }, others).ok).toBe(true);
  });
  it("compares versions and picks the latest", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareVersions("1.0.0-beta", "1.0.0")).toBeLessThan(0);
    const rs = [
      { status: "published" as const, isLatest: false, version: "1.2.0" },
      { status: "published" as const, isLatest: true, version: "1.1.0" },
      { status: "draft" as const, isLatest: true, version: "2.0.0" },
    ];
    expect(pickLatest(rs)?.version).toBe("1.1.0");
    expect(pickLatest(rs.map((r) => ({ ...r, isLatest: false })))?.version).toBe("1.2.0");
    expect(pickLatest([])).toBeNull();
  });
});

describe("admin route protection", () => {
  it("never shows the panel to signed-out or non-admin users", () => {
    expect(resolveAdminAccess("loading", false)).toBe("loading");
    expect(resolveAdminAccess("signed-out", false)).toBe("login");
    expect(resolveAdminAccess("signed-in", false)).toBe("unauthorized");
    expect(resolveAdminAccess("signed-in", true)).toBe("allowed");
  });
});

describe("customer validation", () => {
  const valid = {
    name: "Sam Dlamini", businessName: "Dlamini Hardware", email: "SAM@example.com", phone: "+27 82 000 0000",
    address: "", country: "South Africa", terminals: "3", pricePerTerminal: "350", plan: "Standard", status: "active", notes: "",
  };
  it("coerces form strings and normalises email", () => {
    const r = customerSchema.parse(valid);
    expect(r.terminals).toBe(3);
    expect(r.pricePerTerminal).toBe(350);
    expect(r.email).toBe("sam@example.com");
  });
  it("rejects negative terminals and prices", () => {
    expect(customerSchema.safeParse({ ...valid, terminals: "-1" }).success).toBe(false);
    expect(customerSchema.safeParse({ ...valid, pricePerTerminal: "-5" }).success).toBe(false);
  });
  it("validates subscription dates", () => {
    const sub = { customerId: "c1", plan: "Standard", terminalLimit: "2", pricePerTerminal: "500", billingFrequency: "monthly",
      startDate: "2026-09-27", nextBillingDate: "2026-09-01", status: "PENDING", gracePeriodDays: "5", autoRenewal: true };
    expect(subscriptionSchema.safeParse(sub).success).toBe(false);
    expect(subscriptionSchema.safeParse({ ...sub, nextBillingDate: "2026-10-27" }).success).toBe(true);
    expect(subscriptionSchema.safeParse({ ...sub, nextBillingDate: "2026-10-27", terminalLimit: "0" }).success).toBe(false);
  });
  it("validates release metadata", () => {
    const rel = { version: "1.0.3", title: "GRV update", releaseDate: "2026-09-18", changes: "One\n\nTwo", checksumSha256: "" };
    expect(releaseSchema.parse(rel).changes).toEqual(["One", "Two"]);
    expect(releaseSchema.safeParse({ ...rel, version: "one" }).success).toBe(false);
    expect(releaseSchema.safeParse({ ...rel, checksumSha256: "abc" }).success).toBe(false);
  });
});
