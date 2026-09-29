"use client";

import { Wallet } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/States";
import { METHOD_LABEL } from "@/components/admin/MarkPaidModal";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatDateTime, formatZAR } from "@/lib/utils";
import { listCustomers } from "@/services/customerService";
import { listInvoices } from "@/services/invoiceService";
import { listPayments } from "@/services/paymentService";

export default function PaymentsPage() {
  const { data, loading, error, reload } = useAsyncData(async () => {
    const [payments, customers, invoices] = await Promise.all([listPayments(), listCustomers(), listInvoices()]);
    return { payments, customers, invoices };
  }, []);
  const name = (id: string) => data?.customers.find((c) => c.id === id)?.businessName ?? "Unknown customer";
  const number = (id: string) => data?.invoices.find((i) => i.id === id)?.number ?? "—";

  return (
    <>
      <PageHeader title="Payments" description="Every payment recorded, whether it came from the payment gateway or was marked paid by hand." />
      {error ? <ErrorState title="Couldn't load payments" error={error} onRetry={reload} /> : loading && !data ? <TableSkeleton /> : data && (
        <DataTable
          caption="Payments" csv={{ filename: "payments", columns: [{ header: "Date", value: (p) => (p.paidAt ?? p.createdAt)?.slice(0, 10) }, { header: "Customer", value: (p) => name(p.customerId) }, { header: "Invoice", value: (p) => number(p.invoiceId) }, { header: "Amount (ZAR)", value: (p) => p.amount }, { header: "Method", value: (p) => METHOD_LABEL[p.method] }, { header: "Reference", value: (p) => p.reference }, { header: "Status", value: (p) => p.status }] }} rows={data.payments} rowKey={(p) => p.id} searchPlaceholder="Search payments" searchText={(p) => `${name(p.customerId)} ${number(p.invoiceId)} ${p.reference}`}
          filters={[
            { key: "status", label: "Status", options: ["succeeded", "pending", "failed", "refunded"].map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })), predicate: (p, v) => p.status === v },
            { key: "method", label: "Method", options: Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label })), predicate: (p, v) => p.method === v },
          ]}
          empty={<EmptyState icon={Wallet} title="No payments yet" description="Payments appear here when an invoice is marked paid or the payment gateway confirms one." />}
          columns={[
            { key: "date", header: "Date", sortValue: (p) => p.paidAt ?? p.createdAt ?? "", render: (p) => formatDateTime(p.paidAt ?? p.createdAt) },
            { key: "customer", header: "Customer", sortValue: (p) => name(p.customerId), render: (p) => <Link href={`/admin/customers/${p.customerId}`} className="font-medium hover:underline">{name(p.customerId)}</Link> },
            { key: "invoice", header: "Invoice", render: (p) => <Link href={`/admin/invoices/${p.invoiceId}`} className="hover:underline">{number(p.invoiceId)}</Link> },
            { key: "amount", header: "Amount", align: "right", sortValue: (p) => p.amount, render: (p) => formatZAR(p.amount) },
            { key: "method", header: "Method", render: (p) => METHOD_LABEL[p.method] },
            { key: "source", header: "Source", render: (p) => <span className="text-muted">{p.provider === "manual" ? `Manual, ${p.recordedBy}` : p.provider}</span> },
            { key: "status", header: "Status", sortValue: (p) => p.status, render: (p) => <StatusBadge status={p.status} /> },
          ]}
        />
      )}
    </>
  );
}
