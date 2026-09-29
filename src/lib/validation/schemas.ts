import { z } from "zod";
import { isValidISODate } from "@/lib/dates";
import { SEMVER_RE } from "@/lib/releases/rules";

const isoDate = z.string().refine(isValidISODate, "Use a valid date");
const money = z.coerce.number({ invalid_type_error: "Enter an amount" }).min(0, "Cannot be negative").max(1_000_000, "Too large");
const wholeNumber = (min: number, max: number, label = "Enter a whole number") =>
  z.coerce
    .number({ invalid_type_error: label })
    .int("Use a whole number")
    .min(min, min === 1 ? "Must be at least 1" : `Must be at least ${min}`)
    .max(max, `Must be ${max} or less`);

export const statusEnum = {
  customer: z.enum(["active", "inactive"]),
  subscription: z.enum(["ACTIVE", "PENDING", "OVERDUE", "GRACE", "SUSPENDED", "CANCELLED"]),
  frequency: z.enum(["monthly", "quarterly", "annual"]),
  method: z.enum(["online", "cash", "bank_transfer", "manual", "other"]),
};

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Enter the contact's name").max(120),
  businessName: z.string().trim().min(2, "Enter the business name").max(160),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a phone number")
    .max(30)
    .regex(/^[0-9+()\-\s]+$/, "Use digits, spaces and + ( ) - only"),
  address: z.string().trim().max(300).default(""),
  country: z.string().trim().min(2, "Enter a country").max(80),
  terminals: wholeNumber(1, 1000),
  pricePerTerminal: money,
  plan: z.string().trim().min(1, "Choose a plan").max(80),
  status: statusEnum.customer,
  notes: z.string().trim().max(2000).default(""),
});
export type CustomerInput = z.output<typeof customerSchema>;

export const subscriptionSchema = z
  .object({
    customerId: z.string().min(1, "Choose a customer"),
    plan: z.string().trim().min(1, "Enter a plan name").max(80),
    terminalLimit: wholeNumber(1, 1000),
    pricePerTerminal: money,
    billingFrequency: statusEnum.frequency,
    startDate: isoDate,
    nextBillingDate: isoDate,
    status: statusEnum.subscription,
    gracePeriodDays: wholeNumber(0, 60),
    autoRenewal: z.boolean(),
  })
  .refine((v) => v.nextBillingDate >= v.startDate, {
    path: ["nextBillingDate"],
    message: "Next billing date cannot be before the start date",
  });
export type SubscriptionInput = z.output<typeof subscriptionSchema>;

export const invoiceLineSchema = z.object({
  description: z.string().trim().min(1, "Describe the line").max(200),
  quantity: z.coerce.number().int().min(1, "At least 1").max(10_000),
  unitPrice: money,
});

export const invoiceSchema = z
  .object({
    customerId: z.string().min(1, "Choose a customer"),
    subscriptionId: z.string().nullable().default(null),
    issueDate: isoDate,
    dueDate: isoDate,
    lines: z.array(invoiceLineSchema).min(1, "Add at least one line"),
  })
  .refine((v) => v.dueDate >= v.issueDate, { path: ["dueDate"], message: "Due date cannot be before the issue date" });
export type InvoiceInput = z.output<typeof invoiceSchema>;

export const markPaidSchema = z.object({
  method: statusEnum.method,
  note: z.string().trim().max(500).default(""),
});
export type MarkPaidInput = z.output<typeof markPaidSchema>;

const lines = (max: number) =>
  z
    .string()
    .default("")
    .transform((s) => s.split("\n").map((l) => l.trim()).filter(Boolean))
    .pipe(z.array(z.string().max(300)).max(max));

export const releaseSchema = z.object({
  version: z.string().trim().regex(SEMVER_RE, "Use a version like 1.2.3"),
  title: z.string().trim().min(2, "Enter a title").max(120),
  releaseDate: isoDate,
  platform: z.string().trim().min(1).max(40).default("Windows"),
  changes: lines(60),
  minRequirements: lines(30),
  installInstructions: lines(30),
  checksumSha256: z
    .string()
    .trim()
    .toLowerCase()
    .refine((s) => s === "" || /^[a-f0-9]{64}$/.test(s), "SHA-256 must be 64 hex characters"),
});
export type ReleaseInput = z.output<typeof releaseSchema>;

export const pricingPlanSchema = z.object({
  id: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1, "Name the plan").max(60),
  description: z.string().trim().max(240).default(""),
  pricePerTerminal: money,
  minTerminals: wholeNumber(1, 1000),
  features: z.array(z.string().trim().min(1).max(160)).max(20),
  highlighted: z.boolean(),
});

export const pricingSchema = z.object({
  currency: z.literal("ZAR"),
  billingFrequency: statusEnum.frequency,
  headline: z.string().trim().max(160),
  subtitle: z.string().trim().max(300),
  plans: z.array(pricingPlanSchema).max(6),
});
export type PricingInput = z.output<typeof pricingSchema>;

export const settingsSchema = z.object({
  general: z.object({
    productName: z.string().trim().min(2).max(80),
    supportEmail: z.string().trim().max(160).refine((s) => s === "" || z.string().email().safeParse(s).success, "Enter a valid email"),
    salesEmail: z.string().trim().max(160).refine((s) => s === "" || z.string().email().safeParse(s).success, "Enter a valid email"),
  }),
  branding: z.object({
    logoText: z.string().trim().min(1).max(30),
    accentHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #F2B84B"),
  }),
  billing: z.object({
    vatRate: z.coerce.number().min(0).max(1),
    invoicePrefix: z.string().trim().min(1).max(8),
    billingDay: wholeNumber(1, 28),
    defaultGraceDays: wholeNumber(0, 60),
    reminderDaysBefore: wholeNumber(0, 30),
  }),
  licensing: z.object({
    defaultValidityDays: wholeNumber(1, 400),
    offlineGraceDays: wholeNumber(0, 60),
    verificationIntervalHours: wholeNumber(1, 720),
  }),
  notifications: z.object({ emailEnabled: z.boolean(), sendReminders: z.boolean() }),
  releases: z.object({ requireChecksum: z.boolean() }),
});

export const inquirySchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  phone: z.string().trim().max(30).default(""),
  business: z.string().trim().max(160).default(""),
  message: z.string().trim().min(10, "Tell us a little more (10+ characters)").max(2000),
});

export const notificationSchema = z.object({
  type: z.enum(["payment_reminder", "payment_failed", "invoice_issued", "license_expiry", "subscription_status", "release_announcement", "general"]),
  channel: z.enum(["email", "in_app", "whatsapp"]),
  customerId: z.string().nullable().default(null),
  recipient: z.string().trim().max(160).default(""),
  title: z.string().trim().min(2, "Add a title").max(140),
  message: z.string().trim().min(2, "Write a message").max(2000),
});
