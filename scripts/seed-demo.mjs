#!/usr/bin/env node
/**
 * Loads clearly-labelled DEMO data so you can explore the admin panel: 3 customers, subscriptions, invoices,
 * payments, licences, terminals and a pricing page. Every document id starts with "demo_".
 *   npm run seed:demo              add demo data (refuses if real customers exist)
 *   npm run seed:demo -- --remove  delete everything this script created
 * Demo prices are placeholders, not real pricing. Never run this against a production project with real data.
 */
import { createHash, randomBytes } from "node:crypto";
import { cert, getApp, initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";

const { FIREBASE_ADMIN_PROJECT_ID: projectId, FIREBASE_ADMIN_CLIENT_EMAIL: clientEmail, FIREBASE_ADMIN_PRIVATE_KEY: key } = process.env;
if (!projectId || !clientEmail || !key) { console.error("Missing FIREBASE_ADMIN_* variables. See SETUP.md."); process.exit(1); }
initializeApp({ credential: cert({ projectId, clientEmail, privateKey: key.replace(/\\n/g, "\n") }) });
// Same database the website uses: set NEXT_PUBLIC_FIRESTORE_DATABASE_ID=default in .env.local if yours is named "default".
const db = getFirestore(getApp(), process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID?.trim() || "(default)");

const COLLECTIONS = ["customers", "shops", "subscriptions", "invoices", "payments", "licenses", "terminals", "notifications"];

if (process.argv.includes("--remove")) {
  for (const c of COLLECTIONS) {
    const snap = await db.collection(c).get();
    const demo = snap.docs.filter((d) => d.id.startsWith("demo_"));
    await Promise.all(demo.map((d) => d.ref.delete()));
    console.log(`Removed ${demo.length} demo document(s) from ${c}`);
  }
  await db.collection("pricing").doc("default").delete().catch(() => undefined);
  process.exit(0);
}

const existing = await db.collection("customers").limit(5).get();
if (existing.docs.some((d) => !d.id.startsWith("demo_"))) {
  console.error("This project already has real customers. Refusing to add demo data.");
  process.exit(1);
}

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const monthsAgo = (n) => { const d = new Date(); d.setMonth(d.getMonth() - n); return d; };
const ts = (d) => Timestamp.fromDate(d);
const genToken = () => { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let r = ""; for (const b of randomBytes(20)) r += A[b % 32]; return `MEP-${r.match(/.{4}/g).join("-")}`; };
const hash = (t) => createHash("sha256").update(t).digest("hex");

await db.collection("pricing").doc("default").set({
  currency: "ZAR", billingFrequency: "monthly", headline: "Pay per till, month to month.", subtitle: "DEMO pricing. Replace it in Admin > Pricing.",
  plans: [{ id: "standard", name: "Standard", description: "Everything you need to trade.", pricePerTerminal: 500, minTerminals: 1, features: ["Sales and receipts", "Stock control", "GRV and price maintenance", "Reports"], highlighted: true }],
  updatedAt: FieldValue.serverTimestamp(),
});

const people = [
  { id: "demo_c1", business: "Demo Hardware", name: "Sam Dlamini", email: "sam@demo.example", terminals: 3, price: 350, status: "ACTIVE", ago: 5 },
  { id: "demo_c2", business: "Demo Groceries", name: "Aisha Khan", email: "aisha@demo.example", terminals: 2, price: 500, status: "OVERDUE", ago: 3 },
  { id: "demo_c3", business: "Demo Pharmacy", name: "Pieter Botha", email: "pieter@demo.example", terminals: 1, price: 500, status: "SUSPENDED", ago: 1 },
];
const tokens = {};

for (const p of people) {
  const created = ts(monthsAgo(p.ago));
  await db.collection("customers").doc(p.id).set({ name: p.name, businessName: p.business, email: p.email, phone: "+27 82 000 0000", address: "", country: "South Africa", terminals: p.terminals, pricePerTerminal: p.price, currency: "ZAR", plan: "Standard", status: "active", subscriptionStatus: p.status, notes: "Demo data", createdAt: created, updatedAt: created });
  await db.collection("shops").doc(`${p.id}_shop`).set({ customerId: p.id, name: p.business, address: "", createdAt: created, updatedAt: created });
  const subId = `demo_s_${p.id}`;
  await db.collection("subscriptions").doc(subId).set({ customerId: p.id, plan: "Standard", terminalLimit: p.terminals, pricePerTerminal: p.price, currency: "ZAR", billingFrequency: "monthly", startDate: ymd(monthsAgo(p.ago)), nextBillingDate: ymd(daysFromNow(p.status === "ACTIVE" ? 10 : -3)), status: p.status, gracePeriodDays: 5, autoRenewal: true, createdAt: created, updatedAt: created });

  for (let m = p.ago - 1; m >= 0; m--) {
    const issue = monthsAgo(m);
    const paid = !(m === 0 && p.status !== "ACTIVE");
    const sub = p.terminals * p.price, vat = Math.round(sub * 15) / 100;
    const invId = `demo_i_${p.id}_${m}`;
    await db.collection("invoices").doc(invId).set({ number: `INV-${issue.getFullYear()}${String(issue.getMonth() + 1).padStart(2, "0")}-D${p.id.slice(-1)}${m}`, customerId: p.id, subscriptionId: subId, issueDate: ymd(issue), dueDate: ymd(issue), status: paid ? "PAID" : p.status === "OVERDUE" ? "OVERDUE" : "OVERDUE", lines: [{ description: `Malek Enterprise POS licence, ${p.terminals} terminals (monthly)`, quantity: p.terminals, unitPrice: p.price }], subtotal: sub, vatRate: 0.15, vatAmount: vat, total: sub + vat, currency: "ZAR", paidAt: paid ? ts(issue) : null, paidBy: paid ? "demo" : null, paymentMethod: paid ? "bank_transfer" : null, paymentNote: "", createdAt: ts(issue), updatedAt: ts(issue) });
    if (paid) await db.collection("payments").doc(`demo_p_${p.id}_${m}`).set({ invoiceId: invId, customerId: p.id, amount: sub + vat, currency: "ZAR", method: "bank_transfer", status: "succeeded", provider: "manual", reference: "DEMO", recordedBy: "demo", note: "", paidAt: ts(issue), createdAt: ts(issue), updatedAt: ts(issue) });
  }

  const token = genToken();
  tokens[p.business] = token;
  const licId = `demo_l_${p.id}`;
  await db.collection("licenses").doc(licId).set({ customerId: p.id, subscriptionId: subId, tokenHash: hash(token), tokenPrefix: token.slice(0, 8), terminalLimit: p.terminals, issueDate: ymd(monthsAgo(p.ago)), expiryDate: ymd(daysFromNow(30)), gracePeriodDays: 5, status: "ACTIVE", revoked: false, lastVerifiedAt: ts(daysFromNow(-1)), lastActivityAt: ts(daysFromNow(-1)), createdAt: created, updatedAt: created });
  for (let t = 1; t <= Math.min(p.terminals, 2); t++) {
    await db.collection("terminals").doc(`demo_t_${p.id}_${t}`).set({ customerId: p.id, licenseId: licId, shopId: null, shopName: p.business, deviceName: `Till ${t}`, hardwareIdHash: hash(`${p.id}${t}`), hardwareIdShort: hash(`${p.id}${t}`).slice(0, 8), status: "ACTIVE", localIp: `192.168.1.${10 + t}`, version: "1.0.0", registeredAt: created, lastSeenAt: ts(daysFromNow(-1)), createdAt: created, updatedAt: created });
  }
}

console.log("Demo data added. Demo licence keys (they are only shown now):");
for (const [name, token] of Object.entries(tokens)) console.log(`  ${name}: ${token}`);
