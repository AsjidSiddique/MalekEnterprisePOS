import { z } from "zod";
import type { BillingFrequency, InvoiceLine, PricingPlan } from "@/types";
import { calcTotals } from "@/lib/billing/invoiceRules";
import { MONTHS_PER_CYCLE } from "@/lib/billing/lifecycle";

export const MAX_ORDER_TERMINALS = 200;

export const orderSchema = z.object({
  planId: z.string().min(1, "Choose a plan."),
  terminals: z.number({ invalid_type_error: "Enter the number of tills." }).int("Whole numbers only.").min(1, "You need at least 1 till.").max(MAX_ORDER_TERMINALS, `Contact us for more than ${MAX_ORDER_TERMINALS} tills.`),
  billingFrequency: z.enum(["monthly", "quarterly", "annual"]),
  /** Only needed the first time (when there is no customer record yet). */
  businessName: z.string().trim().max(160).optional(),
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  country: z.string().trim().max(80).optional(),
});
export type OrderInput = z.infer<typeof orderSchema>;

/**
 * Which per-terminal price applies. A price the admin set by hand on the customer wins (that is how per-customer
 * pricing works). Customers created by the sign-up flow are marked `priceSource: "plan"` and simply follow the
 * plan they pick.
 */
export function effectivePrice(customer: { pricePerTerminal: number; priceSource?: string } | null, plan: Pick<PricingPlan, "pricePerTerminal">): number {
  if (customer && customer.priceSource !== "plan" && customer.pricePerTerminal > 0) return customer.pricePerTerminal;
  return plan.pricePerTerminal;
}

export function priceOrder(o: { pricePerTerminal: number; terminals: number; frequency: BillingFrequency; vatRate: number; planName: string }) {
  const months = MONTHS_PER_CYCLE[o.frequency];
  const lines: InvoiceLine[] = [{
    description: `Malek Enterprise POS - ${o.planName}, ${o.terminals} till${o.terminals === 1 ? "" : "s"} (${o.frequency})`,
    quantity: o.terminals, unitPrice: o.pricePerTerminal * months,
  }];
  return { lines, ...calcTotals(lines, o.vatRate) };
}

/** Only these callers may look at a customer's record: the linked user, or a verified email that matches. */
export function mayLinkByEmail(user: { email: string; emailVerified: boolean }, customerEmail: string): boolean {
  return user.emailVerified && user.email !== "" && user.email === customerEmail.trim().toLowerCase();
}
