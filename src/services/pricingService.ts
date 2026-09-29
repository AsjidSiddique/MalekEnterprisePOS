import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import type { AdminActor, Customer, PricingConfig, Subscription } from "@/types";
import type { PricingInput } from "@/lib/validation/schemas";
import { mapPricing, type Data } from "@/lib/mappers";
import { getDb } from "@/lib/firebase/client";
import { auditEntry } from "./auditService";
import { col, docRef, commitBatch } from "./base";

export async function getPricing(): Promise<PricingConfig | null> {
  const snap = await getDoc(docRef("pricing", "default"));
  return snap.exists() ? mapPricing(snap.data() as Data) : null;
}

/** Default (public) pricing. Customer-specific prices live on the customer and subscription records. */
export async function savePricing(actor: AdminActor, input: PricingInput): Promise<void> {
  const batch = writeBatch(getDb());
  batch.set(docRef("pricing", "default"), { ...input, updatedAt: serverTimestamp() });
  batch.set(doc(col("auditLogs")), auditEntry(actor, {
    action: "pricing.updated", targetType: "pricing", targetId: "default", targetLabel: "Default pricing", metadata: { plans: input.plans.map((p) => `${p.name}:${p.pricePerTerminal}`) },
  }));
  await commitBatch(batch);
}

/** Sets one customer's own per-terminal price, and keeps their live subscription in step so the next invoice uses it. */
export async function setCustomerPrice(actor: AdminActor, customer: Customer, price: number, subscription?: Subscription): Promise<void> {
  const batch = writeBatch(getDb());
  batch.update(docRef("customers", customer.id), { pricePerTerminal: price, updatedAt: serverTimestamp() });
  if (subscription && subscription.status !== "CANCELLED") {
    batch.update(docRef("subscriptions", subscription.id), { pricePerTerminal: price, updatedAt: serverTimestamp() });
  }
  batch.set(doc(col("auditLogs")), auditEntry(actor, {
    action: "pricing.customer_price_changed", targetType: "customer", targetId: customer.id, targetLabel: customer.businessName,
    metadata: { from: customer.pricePerTerminal, to: price },
  }));
  await commitBatch(batch);
}
