import { doc, limit, serverTimestamp, writeBatch } from "firebase/firestore";
import type { AdminActor, Customer, CustomerStatus, Shop } from "@/types";
import type { CustomerInput } from "@/lib/validation/schemas";
import { mapCustomer, mapShop } from "@/lib/mappers";
import { getDb } from "@/lib/firebase/client";
import { auditEntry } from "./auditService";
import { col, docRef, getOne, listDocs, newestFirst, whereEq, commitBatch } from "./base";

export const listCustomers = (): Promise<Customer[]> => listDocs("customers", mapCustomer, ...newestFirst());
export const getCustomer = (id: string): Promise<Customer | null> => getOne("customers", id, mapCustomer);

export const listShops = (customerId: string): Promise<Shop[]> => listDocs("shops", mapShop, whereEq("customerId", customerId));

export async function createCustomer(actor: AdminActor, input: CustomerInput): Promise<string> {
  const batch = writeBatch(getDb());
  const ref = doc(col("customers"));
  batch.set(ref, { ...input, currency: "ZAR", subscriptionStatus: "NONE", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  // Every customer starts with one shop so terminals always have somewhere to belong.
  batch.set(doc(col("shops")), {
    customerId: ref.id, name: input.businessName, address: input.address, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  batch.set(doc(col("auditLogs")), auditEntry(actor, { action: "customer.created", targetType: "customer", targetId: ref.id, targetLabel: input.businessName }));
  await commitBatch(batch);
  return ref.id;
}

export async function updateCustomer(actor: AdminActor, id: string, input: CustomerInput): Promise<void> {
  const batch = writeBatch(getDb());
  batch.update(docRef("customers", id), { ...input, updatedAt: serverTimestamp() });
  batch.set(doc(col("auditLogs")), auditEntry(actor, { action: "customer.updated", targetType: "customer", targetId: id, targetLabel: input.businessName }));
  await commitBatch(batch);
}

export async function setCustomerStatus(actor: AdminActor, customer: Customer, status: CustomerStatus): Promise<void> {
  const batch = writeBatch(getDb());
  batch.update(docRef("customers", customer.id), { status, updatedAt: serverTimestamp() });
  batch.set(doc(col("auditLogs")), auditEntry(actor, {
    action: "customer.status_changed", targetType: "customer", targetId: customer.id, targetLabel: customer.businessName, metadata: { from: customer.status, to: status },
  }));
  await commitBatch(batch);
}

export async function createShop(actor: AdminActor, input: { customerId: string; name: string; address: string }): Promise<void> {
  const batch = writeBatch(getDb());
  const ref = doc(col("shops"));
  batch.set(ref, { ...input, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.set(doc(col("auditLogs")), auditEntry(actor, { action: "shop.created", targetType: "customer", targetId: input.customerId, targetLabel: input.name }));
  await commitBatch(batch);
}

/** Customers with billing history can't be deleted — deactivating them keeps invoices and audit trails intact. */
export async function deleteCustomer(actor: AdminActor, customer: Customer): Promise<void> {
  for (const name of ["subscriptions", "invoices", "licenses", "terminals"] as const) {
    const found = await listDocs(name, (id) => id, whereEq("customerId", customer.id), limit(1));
    if (found.length > 0) {
      throw new Error("This customer has subscription, billing or licence records. Deactivate them instead of deleting.");
    }
  }
  const shops = await listShops(customer.id);
  const batch = writeBatch(getDb());
  shops.forEach((s) => batch.delete(docRef("shops", s.id)));
  batch.delete(docRef("customers", customer.id));
  batch.set(doc(col("auditLogs")), auditEntry(actor, { action: "customer.deleted", targetType: "customer", targetId: customer.id, targetLabel: customer.businessName }));
  await commitBatch(batch);
}
