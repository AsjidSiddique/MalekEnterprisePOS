/** Business dates are stored as plain "YYYY-MM-DD" strings (timezone-safe).
 *  createdAt / updatedAt are Firestore server timestamps, exposed here as ISO strings. */
export type ISODateTime = string;
export type ISODate = string;

export interface Timestamps {
  createdAt: ISODateTime | null;
  updatedAt: ISODateTime | null;
}

export type CustomerStatus = "active" | "inactive";
export type SubscriptionStatus = "ACTIVE" | "PENDING" | "OVERDUE" | "GRACE" | "SUSPENDED" | "CANCELLED";
export type BillingFrequency = "monthly" | "quarterly" | "annual";
export type InvoiceStatus = "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";
export type PaymentMethod = "online" | "cash" | "bank_transfer" | "manual" | "other";
export type PaymentStatus = "succeeded" | "pending" | "failed" | "refunded";
export type LicenseStatus = "ACTIVE" | "REVOKED" | "EXPIRED";
export type LicenseState = "ACTIVE" | "GRACE" | "SUSPENDED" | "EXPIRED" | "REVOKED";
export type TerminalStatus = "ACTIVE" | "DISABLED" | "REVOKED";
export type ReleaseStatus = "draft" | "published" | "archived";

export interface Customer extends Timestamps {
  id: string;
  name: string;
  businessName: string;
  email: string;
  phone: string;
  address: string;
  country: string;
  terminals: number;
  pricePerTerminal: number;
  currency: "ZAR";
  plan: string;
  status: CustomerStatus;
  /** Denormalised from the customer's subscription so lists can show it without a join. */
  subscriptionStatus: SubscriptionStatus | "NONE";
  notes: string;
}

export interface Shop extends Timestamps {
  id: string;
  customerId: string;
  name: string;
  address: string;
}

export interface Subscription extends Timestamps {
  id: string;
  customerId: string;
  plan: string;
  terminalLimit: number;
  pricePerTerminal: number;
  currency: "ZAR";
  billingFrequency: BillingFrequency;
  startDate: ISODate;
  nextBillingDate: ISODate;
  status: SubscriptionStatus;
  gracePeriodDays: number;
  autoRenewal: boolean;
}

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice extends Timestamps {
  id: string;
  number: string;
  customerId: string;
  subscriptionId: string | null;
  issueDate: ISODate;
  dueDate: ISODate;
  status: InvoiceStatus;
  lines: InvoiceLine[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  currency: "ZAR";
  paidAt: ISODateTime | null;
  paidBy: string | null;
  paymentMethod: PaymentMethod | null;
  paymentNote: string;
}

export interface Payment extends Timestamps {
  id: string;
  invoiceId: string;
  customerId: string;
  amount: number;
  currency: "ZAR";
  method: PaymentMethod;
  status: PaymentStatus;
  provider: string;
  reference: string;
  recordedBy: string;
  note: string;
  paidAt: ISODateTime | null;
}

/** The token hash is deliberately not part of this type — it never reaches the UI. */
export interface License extends Timestamps {
  id: string;
  customerId: string;
  subscriptionId: string | null;
  tokenPrefix: string;
  terminalLimit: number;
  issueDate: ISODate;
  expiryDate: ISODate;
  gracePeriodDays: number;
  status: LicenseStatus;
  revoked: boolean;
  lastVerifiedAt: ISODateTime | null;
  lastActivityAt: ISODateTime | null;
}

export interface Terminal extends Timestamps {
  id: string;
  customerId: string;
  shopId: string | null;
  shopName: string;
  licenseId: string;
  deviceName: string;
  hardwareIdShort: string;
  status: TerminalStatus;
  registeredAt: ISODateTime | null;
  lastSeenAt: ISODateTime | null;
  localIp: string;
  version: string;
}

export type ReleaseFileKind = "installer" | "checksums" | "documentation" | "sql" | "other";

export type ReleaseFileSource = "upload" | "link";
/** For link files: "proxy" streams the file through our server (the link is never revealed); "redirect" sends visitors to it. */
export type LinkDeliveryMode = "proxy" | "redirect";

export interface ReleaseFile {
  /** Stable id used in download URLs. */
  id: string;
  kind: ReleaseFileKind;
  name: string;
  /** "upload" = stored in our Firebase Storage; "link" = hosted elsewhere (e.g. a GitHub release). */
  source: ReleaseFileSource;
  /** Upload only: Storage path. Never a URL. */
  storagePath: string;
  /** Link only: hostname for display, e.g. "github.com". The full URL is kept server-side and never sent to browsers. */
  linkHost: string;
  deliveryMode: LinkDeliveryMode;
  sizeBytes: number;
  contentType: string;
}

export interface ShareLink extends Timestamps {
  id: string;
  releaseId: string;
  fileId: string;
  label: string;
  expiresAt: ISODateTime | null;
  maxUses: number;
  uses: number;
  revoked: boolean;
  createdBy: string;
  lastUsedAt: ISODateTime | null;
}

export interface DownloadStats {
  releaseId: string;
  total: number;
  /** YYYY-MM-DD → downloads that day. */
  days: Record<string, number>;
  /** file id → downloads. */
  files: Record<string, number>;
}

export interface Release extends Timestamps {
  id: string;
  version: string;
  title: string;
  status: ReleaseStatus;
  isLatest: boolean;
  releaseDate: ISODate;
  platform: string;
  changes: string[];
  minRequirements: string[];
  installInstructions: string[];
  checksumSha256: string;
  files: ReleaseFile[];
  publishedAt: ISODateTime | null;
  archivedAt: ISODateTime | null;
}

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  pricePerTerminal: number;
  minTerminals: number;
  features: string[];
  highlighted: boolean;
}

export interface PricingConfig {
  currency: "ZAR";
  billingFrequency: BillingFrequency;
  headline: string;
  subtitle: string;
  plans: PricingPlan[];
  updatedAt: ISODateTime | null;
}

export type NotificationType =
  | "payment_reminder"
  | "payment_failed"
  | "invoice_issued"
  | "license_expiry"
  | "subscription_status"
  | "release_announcement"
  | "general";
export type NotificationChannel = "email" | "in_app" | "whatsapp";
export type NotificationStatus = "queued" | "sent" | "failed" | "read";

export interface NotificationRecord extends Timestamps {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  customerId: string | null;
  recipient: string;
  title: string;
  message: string;
  status: NotificationStatus;
  scheduledFor: ISODateTime | null;
  sentAt: ISODateTime | null;
  error: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  metadata: Record<string, unknown>;
  createdAt: ISODateTime | null;
}

export interface Inquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  business: string;
  message: string;
  createdAt: ISODateTime | null;
}

export interface AppSettings {
  general: { productName: string; supportEmail: string; salesEmail: string };
  branding: { logoText: string; accentHex: string };
  billing: {
    vatRate: number;
    invoicePrefix: string;
    billingDay: number;
    defaultGraceDays: number;
    reminderDaysBefore: number;
  };
  licensing: { defaultValidityDays: number; offlineGraceDays: number; verificationIntervalHours: number };
  notifications: { emailEnabled: boolean; sendReminders: boolean };
  releases: { requireChecksum: boolean };
}

export interface AdminActor {
  uid: string;
  email: string;
}
