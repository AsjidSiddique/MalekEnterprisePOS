/**
 * Sample data for demo mode (NEXT_PUBLIC_DEMO_MODE=true). Everything here is invented: businesses, people, prices and
 * files. Demo mode replaces Firebase with an in-memory copy of this data, so nothing is stored anywhere.
 */
export type DemoDoc = Record<string, unknown>;
export type DemoSeed = Record<string, Record<string, DemoDoc>>;

export { isDemoMode } from "./flag";

export function buildDemoSeed(now: Date = new Date()): DemoSeed {
  let s = 7;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)] as T;
  const iso = (d: Date) => d.toISOString();
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
  const monthsAgo = (n: number, day = 27) => { const d = new Date(now.getFullYear(), now.getMonth() - n, day, 9, 30); return d; };
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(rnd() * 16).toString(16)).join("");

  const out: DemoSeed = {
    customers: {}, shops: {}, subscriptions: {}, invoices: {}, payments: {}, licenses: {}, terminals: {}, notifications: {},
    inquiries: {}, auditLogs: {}, releases: {}, pricing: {}, settings: {}, downloads: {}, shareLinks: {},
  };

  const people = [
    { id: "c1", biz: "Khumalo Hardware", name: "Sipho Khumalo", city: "Johannesburg", t: 3, price: 350, st: "ACTIVE", ago: 8 },
    { id: "c2", biz: "Bosman's Bakery", name: "Annelize Bosman", city: "Stellenbosch", t: 2, price: 500, st: "ACTIVE", ago: 7 },
    { id: "c3", biz: "Naidoo Family Pharmacy", name: "Priya Naidoo", city: "Durban", t: 2, price: 500, st: "OVERDUE", ago: 6 },
    { id: "c4", biz: "Cape Corner Grocers", name: "Ismail Adams", city: "Cape Town", t: 4, price: 400, st: "ACTIVE", ago: 6 },
    { id: "c5", biz: "Mokoena Auto Spares", name: "Thabo Mokoena", city: "Pretoria", t: 1, price: 500, st: "PENDING", ago: 0 },
    { id: "c6", biz: "Greenline Garden Centre", name: "Lerato Dube", city: "Bloemfontein", t: 2, price: 450, st: "GRACE", ago: 4 },
    { id: "c7", biz: "Van Wyk Building Supplies", name: "Hendrik van Wyk", city: "Polokwane", t: 3, price: 350, st: "SUSPENDED", ago: 5 },
    { id: "c8", biz: "Sunrise Tuckshop", name: "Zanele Ndlovu", city: "Soweto", t: 1, price: 500, st: "ACTIVE", ago: 2 },
    { id: "c9", biz: "Ocean View Bottle Store", name: "Craig Pillay", city: "Gqeberha", t: 2, price: 500, st: "CANCELLED", ago: 7 },
  ];

  for (const p of people) {
    const created = iso(monthsAgo(p.ago, 3));
    out.customers![p.id] = {
      name: p.name, businessName: p.biz, email: `${p.name.split(" ")[0]!.toLowerCase()}@${p.biz.split(" ")[0]!.toLowerCase().replace(/[^a-z]/g, "")}.example`,
      phone: `+27 8${Math.floor(rnd() * 3) + 1} ${100 + Math.floor(rnd() * 899)} ${1000 + Math.floor(rnd() * 8999)}`, address: `${Math.floor(rnd() * 200) + 1} Main Road, ${p.city}`,
      country: "South Africa", terminals: p.t, pricePerTerminal: p.price, currency: "ZAR", plan: "Standard",
      status: p.st === "CANCELLED" ? "inactive" : "active", subscriptionStatus: p.st, notes: p.id === "c3" ? "Pays by EFT, usually 10 days late." : "", createdAt: created, updatedAt: created,
    };
    out.shops![`${p.id}_s1`] = { customerId: p.id, name: `${p.biz} (${p.city})`, address: "", createdAt: created, updatedAt: created };
    const subId = `s_${p.id}`;
    const overdueLike = ["OVERDUE", "GRACE", "SUSPENDED"].includes(p.st);
    out.subscriptions![subId] = {
      customerId: p.id, plan: "Standard", terminalLimit: p.t, pricePerTerminal: p.price, currency: "ZAR", billingFrequency: "monthly",
      startDate: ymd(monthsAgo(p.ago, 3)), nextBillingDate: ymd(overdueLike ? daysAgo(3) : new Date(now.getFullYear(), now.getMonth() + (now.getDate() > 27 ? 1 : 0), 27)),
      status: p.st, gracePeriodDays: 5, autoRenewal: p.st !== "CANCELLED", createdAt: created, updatedAt: created,
    };
    const months = Math.max(p.ago, 1);
    for (let m = months - 1; m >= 0; m--) {
      const issue = m === 0 ? daysAgo(13) : monthsAgo(m, 27);
      if (issue > now) continue;
      const unpaid = m === 0 && (overdueLike || p.st === "PENDING");
      const cancelledTail = p.st === "CANCELLED" && m < 2;
      if (cancelledTail) continue;
      const sub = p.t * p.price, vat = r2(sub * 0.15), total = r2(sub + vat);
      const status = unpaid ? (p.st === "PENDING" ? "PENDING" : "OVERDUE") : "PAID";
      const id = `i_${p.id}_${m}`;
      const paidAt = iso(new Date(issue.getTime() + Math.floor(rnd() * 5 + 1) * 86_400_000));
      out.invoices![id] = {
        number: `INV-${issue.getFullYear()}${String(issue.getMonth() + 1).padStart(2, "0")}-${String(Object.keys(out.invoices!).length + 1).padStart(4, "0")}`,
        customerId: p.id, subscriptionId: subId, issueDate: ymd(issue), dueDate: ymd(issue), status,
        lines: [{ description: `Malek Enterprise POS licence, ${p.t} terminal${p.t === 1 ? "" : "s"} (monthly)`, quantity: p.t, unitPrice: p.price }],
        subtotal: sub, vatRate: 0.15, vatAmount: vat, total, currency: "ZAR",
        paidAt: status === "PAID" ? paidAt : null, paidBy: status === "PAID" ? "admin@malek.example" : null, paymentMethod: status === "PAID" ? pick(["bank_transfer", "bank_transfer", "cash", "online"]) : null,
        paymentNote: "", createdAt: iso(issue), updatedAt: iso(issue),
      };
      if (status === "PAID") {
        out.payments![`p_${p.id}_${m}`] = {
          invoiceId: id, customerId: p.id, amount: total, currency: "ZAR", method: (out.invoices![id] as DemoDoc).paymentMethod, status: "succeeded",
          provider: (out.invoices![id] as DemoDoc).paymentMethod === "online" ? "yoco" : "manual", reference: `REF${hex(6).toUpperCase()}`, recordedBy: "admin@malek.example", note: "", paidAt, createdAt: paidAt, updatedAt: paidAt,
        };
      }
    }
    if (p.id !== "c5") {
      const licId = `l_${p.id}`;
      const token = `MEP-${hex(4)}`.toUpperCase();
      out.licenses![licId] = {
        customerId: p.id, subscriptionId: subId, tokenHash: hex(64), tokenPrefix: token, terminalLimit: p.t, issueDate: ymd(monthsAgo(p.ago, 3)),
        expiryDate: ymd(new Date(now.getTime() + (p.st === "SUSPENDED" ? -12 : 34) * 86_400_000)), gracePeriodDays: 5, status: p.st === "CANCELLED" ? "REVOKED" : "ACTIVE",
        revoked: p.st === "CANCELLED", lastVerifiedAt: iso(daysAgo(p.st === "SUSPENDED" ? 20 : Math.floor(rnd() * 2))), lastActivityAt: iso(daysAgo(1)), createdAt: created, updatedAt: created,
      };
      for (let t = 1; t <= Math.max(p.t - (p.id === "c4" ? 1 : 0), 1); t++) {
        out.terminals![`t_${p.id}_${t}`] = {
          customerId: p.id, licenseId: licId, shopId: null, shopName: p.biz, deviceName: t === 1 ? "Front till" : t === 2 ? "Back office" : `Till ${t}`,
          hardwareIdHash: hex(64), hardwareIdShort: hex(8), status: p.st === "CANCELLED" ? "REVOKED" : t === 3 && p.id === "c1" ? "DISABLED" : "ACTIVE",
          localIp: `192.168.1.${20 + t}`, version: pick(["1.4.2", "1.4.2", "1.4.1"]), registeredAt: created, lastSeenAt: iso(daysAgo(p.st === "SUSPENDED" ? 20 : Math.floor(rnd() * 3))), createdAt: created, updatedAt: created,
        };
      }
    }
  }

  const notes: [string, string, string, string, string][] = [
    ["c3", "payment_reminder", "Invoice is overdue", "sent", "Hi Naidoo Family Pharmacy, your invoice is overdue."],
    ["c6", "subscription_status", "Your account is overdue", "sent", "Your account is overdue but your system keeps working."],
    ["c7", "subscription_status", "Your licence has been suspended", "sent", "Your licence has been suspended."],
    ["c1", "payment_reminder", "Invoice is due soon", "queued", "A friendly reminder that your invoice is due."],
    ["c4", "invoice_issued", "New invoice", "queued", "Your invoice has been issued."],
    ["c2", "release_announcement", "Version 1.4.2 is out", "failed", "A new version is available."],
  ];
  notes.forEach(([cid, type, title, status, message], i) => {
    const c = out.customers![cid] as DemoDoc;
    out.notifications![`n${i}`] = { type, channel: "email", customerId: cid, recipient: c.email, title, message, status, scheduledFor: null, sentAt: status === "sent" ? iso(daysAgo(i + 1)) : null, error: status === "failed" ? "Email isn't configured yet." : "", createdAt: iso(daysAgo(i + 1)), updatedAt: iso(daysAgo(i + 1)) };
  });

  [
    ["Refilwe Sithole", "refilwe@corner.example", "Corner Cafe", "Hi, we run 2 tills and a small kitchen printer. Can the POS print to a separate kitchen slip?", 0],
    ["Marius Joubert", "marius@joubert.example", "Joubert Motors", "Do you offer a discount if we sign up for 6 tills across 2 branches?", 1],
    ["Nokuthula Zulu", "nokuthula@zulu.example", "", "Is there a trial version I can install to test with my stock list?", 3],
    ["Ahmed Hassan", "ahmed@hassan.example", "Hassan Wholesalers", "We need barcode label printing. Is that supported?", 5],
  ].forEach(([name, email, business, message, ago], i) => {
    out.inquiries![`q${i}`] = { name, email, phone: "", business, message, createdAt: iso(daysAgo(ago as number)) };
  });

  const actors = ["admin@malek.example", "system"];
  [
    ["auth.login", "user", "admin@malek.example", 0], ["invoice.marked_paid", "customer", "INV-0031", 0], ["release.published", "release", "v1.4.2", 1],
    ["license.generated", "customer", "MEP-4F2A", 2], ["customer.created", "customer", "Sunrise Tuckshop", 2], ["billing.job_run", "system", "daily", 1],
    ["terminal.disabled", "terminal", "Till 3", 3], ["subscription.status_synced", "customer", "Van Wyk Building Supplies", 4], ["settings.updated", "settings", "Billing", 5],
    ["release.link_added", "release", "v1.4.1", 6], ["pricing.updated", "pricing", "Standard", 8], ["invoice.created", "customer", "INV-0030", 9],
  ].forEach(([action, targetType, label, ago], i) => {
    out.auditLogs![`a${i}`] = { userId: "demo", userEmail: label === "daily" ? actors[1] : actors[0], action, targetType, targetId: String(label), targetLabel: String(label), metadata: {}, createdAt: iso(new Date(now.getTime() - (ago as number) * 86_400_000 - i * 3_600_000)) };
  });

  out.pricing!.default = {
    currency: "ZAR", billingFrequency: "monthly", headline: "Pay per till, month to month.", subtitle: "One licence covers the shop server and every till you register against it.",
    plans: [
      { id: "standard", name: "Standard", description: "Everything a single-shop retailer needs to trade.", pricePerTerminal: 500, minTerminals: 1, features: ["Sales, receipts and cash-up", "Stock control across every till", "Goods received vouchers (GRV)", "Price maintenance by markup or GP%", "Sales, stock and margin reports", "Works through internet outages"], highlighted: true },
      { id: "volume", name: "Volume", description: "For shops running four or more tills.", pricePerTerminal: 350, minTerminals: 4, features: ["Everything in Standard", "Lower price per till", "Priority support by phone", "Free installation assistance"], highlighted: false },
    ],
  };
  out.settings!.app = {
    general: { productName: "Malek Enterprise POS", supportEmail: "support@malek.example", salesEmail: "sales@malek.example" },
    branding: { logoText: "Malek", accentHex: "#FFC72C" }, billing: { vatRate: 0.15, invoicePrefix: "INV", billingDay: 27, defaultGraceDays: 5, reminderDaysBefore: 3 },
    licensing: { defaultValidityDays: 35, offlineGraceDays: 7, verificationIntervalHours: 24 }, notifications: { sendReminders: true, emailEnabled: false }, releases: { requireChecksum: true },
  };
  out.settings!.public = { supportEmail: "support@malek.example", salesEmail: "sales@malek.example" };

  const rel = (id: string, version: string, title: string, status: string, ago: number, files: DemoDoc[], changes: string[], latest = false) => {
    out.releases![id] = {
      version, title, status, isLatest: latest, releaseDate: ymd(daysAgo(ago)), platform: "Windows", changes,
      minRequirements: ["Windows 10 or 11 (64-bit)", "4 GB RAM (8 GB for the shop server)", "2 GB free disk space", "A receipt printer that installs as a Windows printer"],
      installInstructions: ["Run the installer on the shop PC and choose \"Shop server\".", "Enter your licence key when asked.", "Install the till version on each till and point it at the server."],
      checksumSha256: hex(64), files, publishedAt: status === "published" ? iso(daysAgo(ago)) : null, archivedAt: status === "archived" ? iso(daysAgo(ago - 10)) : null,
      createdAt: iso(daysAgo(ago + 1)), updatedAt: iso(daysAgo(ago)),
    };
  };
  const inst = (id: string, size: number, extra: DemoDoc): DemoDoc => ({ id, kind: "installer", name: "MalekPOS-Setup.exe", sizeBytes: size, contentType: "application/octet-stream", storagePath: "", linkHost: "", deliveryMode: "proxy", source: "upload", ...extra });
  rel("rel_142", "1.4.2", "Faster GRV capture and price-label fixes", "published", 6, [
    inst("a1b2c3d4e5", 524_288_000, { storagePath: "releases/rel_142/installer.exe", name: "MalekPOS-Setup-1.4.2.exe" }),
    { id: "f6a7b8c9d0", kind: "documentation", name: "Quick-start-guide.pdf", sizeBytes: 2_411_008, contentType: "application/pdf", source: "upload", storagePath: "releases/rel_142/Quick-start-guide.pdf", linkHost: "", deliveryMode: "proxy" },
  ], ["GRV screen now shows markup % and GP % side by side as you type", "Price maintenance no longer resets the cursor when a row saves", "Receipt reprint keeps the original cashier name", "Fixed a crash when a till reconnected during a stock take"], true);
  rel("rel_141", "1.4.1", "Stability release", "published", 34, [inst("b2c3d4e5f6", 519_045_120, { source: "link", linkHost: "github.com", name: "MalekPOS-Setup-1.4.1.exe" })], ["Improved reconnect handling between tills and the shop server", "Corrected VAT rounding on split payments"]);
  rel("rel_150", "1.5.0-beta", "Loyalty points (private beta)", "draft", 1, [inst("c3d4e5f6a7", 531_628_032, { source: "link", linkHost: "github.com", deliveryMode: "redirect", name: "MalekPOS-Setup-1.5.0-beta.exe" })], ["Loyalty points and customer accounts", "New end-of-day summary report"]);
  rel("rel_130", "1.3.0", "Multi-till support", "archived", 120, [inst("d4e5f6a7b8", 513_802_240, { storagePath: "releases/rel_130/installer.exe", name: "MalekPOS-Setup-1.3.0.exe" })], ["Register several tills against one shop server"]);

  const days: Record<string, number> = {};
  for (let i = 0; i < 30; i++) days[ymd(daysAgo(i))] = Math.max(0, Math.round(3 + rnd() * 9 - i * 0.06));
  out.downloads!.rel_142 = { total: Object.values(days).reduce((a, b) => a + b, 0) + 41, days, files: { a1b2c3d4e5: 212, f6a7b8c9d0: 63 } };
  out.downloads!.rel_141 = { total: 187, days: { [ymd(daysAgo(20))]: 6, [ymd(daysAgo(25))]: 4 }, files: { b2c3d4e5f6: 187 } };

  out.shareLinks![hex(64)] = { releaseId: "rel_150", fileId: "c3d4e5f6a7", label: "Beta for Van Wyk", expiresAt: iso(new Date(now.getTime() + 2 * 86_400_000)), maxUses: 3, uses: 1, revoked: false, createdBy: "admin@malek.example", lastUsedAt: iso(daysAgo(0)), createdAt: iso(daysAgo(1)), updatedAt: iso(daysAgo(0)) };
  out.shareLinks![hex(64)] = { releaseId: "rel_142", fileId: "a1b2c3d4e5", label: "For Sunrise Tuckshop install", expiresAt: iso(daysAgo(3)), maxUses: 2, uses: 2, revoked: false, createdBy: "admin@malek.example", lastUsedAt: iso(daysAgo(4)), createdAt: iso(daysAgo(5)), updatedAt: iso(daysAgo(4)) };
  return out;
}
