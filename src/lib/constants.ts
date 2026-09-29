export const PRODUCT_NAME = "Malek Enterprise POS";
// `||` (not `??`) is deliberate here: if NEXT_PUBLIC_SITE_URL is ever set to an
// empty string on the hosting platform (rather than left unset), `??` would NOT
// fall back — only `null`/`undefined` trigger it, not "" — and the empty string
// would flow into `new URL(SITE_URL)` in layout.tsx, crashing the entire build
// with "TypeError: Invalid URL". `||` falls back on any falsy value, including "".
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export const COLLECTIONS = {
  users: "users",
  customers: "customers",
  shops: "shops",
  subscriptions: "subscriptions",
  invoices: "invoices",
  payments: "payments",
  licenses: "licenses",
  terminals: "terminals",
  releases: "releases",
  pricing: "pricing",
  notifications: "notifications",
  auditLogs: "auditLogs",
  settings: "settings",
  inquiries: "inquiries",
  downloads: "downloads",
  shareLinks: "shareLinks",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

export const PUBLIC_NAV = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/releases", label: "Releases" },
  { href: "/download", label: "Download" },
  { href: "/account", label: "My account" },
] as const;

export const DEFAULT_SETTINGS = {
  general: { productName: PRODUCT_NAME, supportEmail: "", salesEmail: "" },
  branding: { logoText: "Malek", accentHex: "#F2B84B" },
  billing: { vatRate: 0.15, invoicePrefix: "INV", billingDay: 27, defaultGraceDays: 5, reminderDaysBefore: 3 },
  licensing: { defaultValidityDays: 35, offlineGraceDays: 7, verificationIntervalHours: 24 },
  notifications: { emailEnabled: false, sendReminders: true },
  releases: { requireChecksum: false },
} as const;
