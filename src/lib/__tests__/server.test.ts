import { createHmac, generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { GatewayError, MockGateway, getGateway } from "@/lib/billing/gateway";
import { buildDashboard, lastMonths } from "@/lib/dashboard";
import { nextOccurrenceOfDay } from "@/lib/dates";
import { signLease, verifyLease } from "@/lib/licensing/lease";
import { mapLicense, mapSubscription, mapSettings } from "@/lib/mappers";

afterEach(() => { delete process.env.LICENSE_SIGNING_PRIVATE_KEY; });

describe("signed licence lease", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const pubPem = publicKey.export({ type: "spki", format: "pem" }).toString();

  it("verifies with the public key and rejects tampering", () => {
    process.env.LICENSE_SIGNING_PRIVATE_KEY = privPem.replace(/\n/g, "\\n");
    const { lease, signature } = signLease({ v: 1, operational: true });
    expect(signature).toBeTruthy();
    expect(verifyLease(lease, signature!, pubPem)).toBe(true);
    expect(verifyLease(lease.replace("true", "false"), signature!, pubPem)).toBe(false);
  });

  it("returns an unsigned lease when no key is configured", () => {
    expect(signLease({ a: 1 }).signature).toBeNull();
  });

  it("rejects a signature from a different key", () => {
    process.env.LICENSE_SIGNING_PRIVATE_KEY = privPem.replace(/\n/g, "\\n");
    const other = generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }).toString();
    const { lease, signature } = signLease({ x: 1 });
    expect(verifyLease(lease, signature!, other)).toBe(false);
  });
});

describe("payment gateway", () => {
  const secret = "test-secret";
  const body = JSON.stringify({ type: "payment.succeeded", reference: "ref_1", invoiceId: "inv_1", amount: 575, currency: "ZAR" });
  const sign = (b: string) => createHmac("sha256", secret).update(b).digest("hex");
  const headers = (sig: string) => new Headers({ "x-signature": sig });

  it("accepts a correctly signed event", () => {
    expect(new MockGateway(secret).verifyAndParse(body, headers(sign(body)))).toMatchObject({ reference: "ref_1", amount: 575 });
  });
  it("rejects a bad or missing signature", () => {
    expect(() => new MockGateway(secret).verifyAndParse(body, headers("00"))).toThrow(GatewayError);
    expect(() => new MockGateway(secret).verifyAndParse(body, new Headers())).toThrow(GatewayError);
  });
  it("rejects a body changed after signing", () => {
    expect(() => new MockGateway(secret).verifyAndParse(body.replace("575", "1"), headers(sign(body)))).toThrow(/signature/i);
  });
  it("is honest about Yoco not being built yet and about missing config", () => {
    expect(() => getGateway({ PAYMENT_PROVIDER: "yoco" } as unknown as NodeJS.ProcessEnv)).toThrow(/been implemented/i);
    expect(() => getGateway({} as unknown as NodeJS.ProcessEnv)).toThrow(/configured/i);
  });
});

describe("dates", () => {
  it("finds the next billing day", () => {
    expect(nextOccurrenceOfDay("2026-09-21", 27)).toBe("2026-09-27");
    expect(nextOccurrenceOfDay("2026-09-27", 27)).toBe("2026-10-27");
    expect(nextOccurrenceOfDay("2026-12-30", 27)).toBe("2027-01-27");
  });
});

describe("mappers", () => {
  it("never carries the licence key hash into the UI model", () => {
    const lic = mapLicense("l1", { customerId: "c1", tokenHash: "secret-hash", tokenPrefix: "MEP-ABCD", expiryDate: "2026-12-01" });
    expect(JSON.stringify(lic)).not.toContain("secret-hash");
  });
  it("survives missing and malformed fields", () => {
    expect(mapSubscription("s1", { terminalLimit: "oops" }).terminalLimit).toBeTypeOf("number");
    expect(mapSettings(null).billing.vatRate).toBe(0.15);
  });
});

describe("dashboard", () => {
  it("builds six month series and counts", () => {
    const stats = buildDashboard({ customers: [], subscriptions: [], invoices: [], payments: [], licenses: [], terminals: [], releases: [] }, "2026-09-21");
    expect(stats.revenue).toHaveLength(6);
    expect(stats.cards.latestVersion).toBeNull();
    expect(lastMonths(6, "2026-09-21").map((m) => m.key)).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
  });
});

import { buildReports, receivablesAgeing } from "@/lib/reports";
import type { Invoice } from "@/types";

const inv = (o: Partial<Invoice>): Invoice => ({ id: "i", number: "INV-1", customerId: "c1", subscriptionId: "s1", issueDate: "2026-08-01", dueDate: "2026-08-01", status: "PENDING", lines: [], subtotal: 100, vatRate: 0.15, vatAmount: 15, total: 115, currency: "ZAR", paidAt: null, paidBy: null, paymentMethod: null, paymentNote: "", createdAt: null, updatedAt: null, ...o } as Invoice);

describe("reports", () => {
  it("buckets receivables by how late they are and ignores paid or cancelled", () => {
    const today = "2026-09-21";
    const rows = receivablesAgeing([
      inv({ dueDate: "2026-09-25" }), inv({ dueDate: "2026-09-10" }), inv({ dueDate: "2026-08-01", status: "OVERDUE" }),
      inv({ dueDate: "2026-06-01", status: "OVERDUE" }), inv({ status: "PAID" }), inv({ status: "CANCELLED" }),
    ], today);
    expect(rows.map((r) => r.count)).toEqual([1, 1, 1, 1]);
    expect(rows.reduce((t, r) => t + r.amount, 0)).toBe(460);
  });
  it("copes with no data at all", () => {
    const r = buildReports({ customers: [], subscriptions: [], invoices: [], payments: [] }, "2026-09-21");
    expect(r).toMatchObject({ mrr: 0, arpu: 0, collectionRate: 100 });
    expect(r.revenueByMonth).toHaveLength(12);
  });
});

import { buildAccessRows, expiryLabel } from "@/lib/access";
import type { Customer, License, Subscription, Terminal } from "@/types";

const cust = (id: string, name: string): Customer => ({ id, name, businessName: name, email: "", phone: "", address: "", country: "", terminals: 1, pricePerTerminal: 0, currency: "ZAR", plan: "Standard", status: "active", subscriptionStatus: "ACTIVE", notes: "", createdAt: null, updatedAt: null });
const sub = (customerId: string, status: Subscription["status"]): Subscription => ({ id: `s_${customerId}`, customerId, plan: "Standard", terminalLimit: 2, pricePerTerminal: 500, currency: "ZAR", billingFrequency: "monthly", startDate: "2026-01-01", nextBillingDate: "2026-10-01", status, gracePeriodDays: 5, autoRenewal: true, createdAt: null, updatedAt: null });
const lic = (customerId: string, o: Partial<License> = {}): License => ({ id: `l_${customerId}`, customerId, subscriptionId: `s_${customerId}`, tokenPrefix: "MEP-AAAA", terminalLimit: 2, issueDate: "2026-01-01", expiryDate: "2026-10-20", gracePeriodDays: 5, status: "ACTIVE", revoked: false, lastVerifiedAt: null, lastActivityAt: null, createdAt: null, updatedAt: null, ...o });
const term = (customerId: string, id: string, status: Terminal["status"]): Terminal => ({ id, customerId, licenseId: `l_${customerId}`, shopId: null, shopName: "", deviceName: id, hardwareIdShort: "", status, localIp: "", version: "", registeredAt: null, lastSeenAt: null, createdAt: null, updatedAt: null });

describe("access control aggregation", () => {
  const today = "2026-09-21";

  it("orders expired first, then expiring soon, then blocked, then everyone else", () => {
    const rows = buildAccessRows({
      customers: [cust("a", "Normal Co"), cust("b", "Expired Co"), cust("c", "Soon Co"), cust("d", "Blocked Co")],
      subscriptions: [sub("a", "ACTIVE"), sub("b", "ACTIVE"), sub("c", "ACTIVE"), sub("d", "ACTIVE")],
      licenses: [lic("a", { expiryDate: "2027-01-01" }), lic("b", { expiryDate: "2026-08-01" }), lic("c", { expiryDate: "2026-09-30" }), lic("d", { revoked: true, status: "REVOKED" })],
      terminals: [],
    }, today);
    expect(rows.map((r) => r.customer.businessName)).toEqual(["Expired Co", "Soon Co", "Blocked Co", "Normal Co"]);
  });

  it("flags fully blocked only when the licence and every terminal are blocked", () => {
    const rows = buildAccessRows({
      customers: [cust("a", "A")], subscriptions: [sub("a", "SUSPENDED")], licenses: [lic("a")],
      terminals: [term("a", "t1", "DISABLED"), term("a", "t2", "REVOKED")],
    }, today);
    expect(rows[0]!.fullyBlocked).toBe(true);
    expect(rows[0]!.fullyAllowed).toBe(false);
  });

  it("a still-active terminal keeps the account from being fully blocked", () => {
    const rows = buildAccessRows({
      customers: [cust("a", "A")], subscriptions: [sub("a", "SUSPENDED")], licenses: [lic("a")],
      terminals: [term("a", "t1", "DISABLED"), term("a", "t2", "ACTIVE")],
    }, today);
    expect(rows[0]!.fullyBlocked).toBe(false);
  });

  it("fully allowed means an operational licence and every terminal active", () => {
    const rows = buildAccessRows({
      customers: [cust("a", "A")], subscriptions: [sub("a", "ACTIVE")], licenses: [lic("a", { expiryDate: "2027-01-01" })],
      terminals: [term("a", "t1", "ACTIVE"), term("a", "t2", "ACTIVE")],
    }, today);
    expect(rows[0]!.fullyAllowed).toBe(true);
  });

  it("copes with a customer that has no licence or terminals yet", () => {
    const rows = buildAccessRows({ customers: [cust("a", "A")], subscriptions: [], licenses: [], terminals: [] }, today);
    expect(rows[0]).toMatchObject({ license: null, licenseState: null, daysToExpiry: null, activeTerminals: 0, fullyAllowed: true });
  });

  it("labels expiry in plain language", () => {
    expect(expiryLabel(null)).toMatchObject({ text: "No licence", tone: "neutral" });
    expect(expiryLabel(-3)).toMatchObject({ tone: "bad" });
    expect(expiryLabel(0)).toMatchObject({ text: "Expires today", tone: "bad" });
    expect(expiryLabel(5)).toMatchObject({ tone: "warn" });
    expect(expiryLabel(30)).toMatchObject({ tone: "ok" });
  });
});
