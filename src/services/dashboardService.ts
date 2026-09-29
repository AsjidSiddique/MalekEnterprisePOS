import { buildDashboard, type DashboardStats } from "@/lib/dashboard";
import { listCustomers } from "./customerService";
import { listSubscriptions } from "./subscriptionService";
import { listInvoices } from "./invoiceService";
import { listPayments } from "./paymentService";
import { listLicenses } from "./licenseService";
import { listTerminals } from "./terminalService";
import { listDownloadStats, listReleases } from "./releaseService";
import { listAuditLogs } from "./auditService";
import { listInquiries } from "./notificationService";

/** One-shot read (no realtime listeners) of everything the dashboard summarises. */
export async function loadDashboard(): Promise<DashboardStats> {
  const [customers, subscriptions, invoices, payments, licenses, terminals, releases, auditLogs, inquiries, downloads] = await Promise.all([
    listCustomers(), listSubscriptions(), listInvoices(), listPayments(), listLicenses(), listTerminals(), listReleases(),
    listAuditLogs(12), listInquiries(), listDownloadStats().catch(() => []),
  ]);
  return buildDashboard({ customers, subscriptions, invoices, payments, licenses, terminals, releases, auditLogs, inquiries, downloads });
}
