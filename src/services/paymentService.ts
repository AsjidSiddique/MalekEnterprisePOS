import type { Payment } from "@/types";
import { mapPayment } from "@/lib/mappers";
import { listDocs, newestFirst, whereEq } from "./base";

export const listPayments = (): Promise<Payment[]> => listDocs("payments", mapPayment, ...newestFirst());
export const listPaymentsForCustomer = (customerId: string): Promise<Payment[]> =>
  listDocs("payments", mapPayment, whereEq("customerId", customerId));
