"use client";

import { CreditCard, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { InvoiceFormModal } from "@/components/admin/InvoiceFormModal";
import { RowMenu } from "@/components/admin/RowMenu";
import { SubscriptionFormModal } from "@/components/admin/SubscriptionFormModal";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useAsyncData";
import { cycleAmount } from "@/lib/billing/lifecycle";
import { formatDate, formatZAR } from "@/lib/utils";
import { listCustomers } from "@/services/customerService";
import { getSettings } from "@/services/settingsService";
import { listSubscriptions } from "@/services/subscriptionService";
import type { Subscription } from "@/types";

export default function SubscriptionsPage() {
  const { data, loading, error, reload } = useAsyncData(async () => {
    const [customers, subscriptions, settings] = await Promise.all([listCustomers(), listSubscriptions(), getSettings()]);
    return { customers, subscriptions, settings };
  }, []);
  const [form, setForm] = useState<{ sub?: Subscription } | null>(null);
  const [invoiceFor, setInvoiceFor] = useState<string | null>(null);

  const name = (id: string) => data?.customers.find((c) => c.id === id)?.businessName ?? "Unknown customer";
  const add = <Button variant="dark" onClick={() => setForm({})}><Plus className="h-4 w-4" aria-hidden />New subscription</Button>;

  return (
    <>
      <PageHeader title="Subscriptions" description="Each customer's plan, terminal limit and billing cycle." actions={add} />
      {error ? <ErrorState title="Couldn't load subscriptions" error={error} onRetry={reload} /> : loading && !data ? <TableSkeleton /> : data && (
        <DataTable
          caption="Subscriptions" csv={{ filename: "subscriptions", columns: [{ header: "Customer", value: (s) => name(s.customerId) }, { header: "Plan", value: (s) => s.plan }, { header: "Terminals", value: (s) => s.terminalLimit }, { header: "Price per terminal (ZAR)", value: (s) => s.pricePerTerminal }, { header: "Billing", value: (s) => s.billingFrequency }, { header: "Next billing", value: (s) => s.nextBillingDate }, { header: "Status", value: (s) => s.status }] }} rows={data.subscriptions} rowKey={(s) => s.id} searchPlaceholder="Search subscriptions" searchText={(s) => `${name(s.customerId)} ${s.plan}`}
          filters={[{ key: "status", label: "Status", options: ["ACTIVE", "PENDING", "OVERDUE", "GRACE", "SUSPENDED", "CANCELLED"].map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() })), predicate: (s, v) => s.status === v }]}
          empty={<EmptyState icon={CreditCard} title="No subscriptions yet" description="Create a subscription for a customer to start billing them." action={add} />}
          columns={[
            { key: "customer", header: "Customer", sortValue: (s) => name(s.customerId), render: (s) => <Link href={`/admin/customers/${s.customerId}`} className="font-medium hover:underline">{name(s.customerId)}</Link> },
            { key: "plan", header: "Plan", sortValue: (s) => s.plan, render: (s) => s.plan },
            { key: "terminals", header: "Terminals", align: "right", sortValue: (s) => s.terminalLimit, render: (s) => s.terminalLimit },
            { key: "amount", header: "Per cycle", align: "right", sortValue: (s) => cycleAmount(s.terminalLimit, s.pricePerTerminal, s.billingFrequency), render: (s) => <span title={`${s.billingFrequency}`}>{formatZAR(cycleAmount(s.terminalLimit, s.pricePerTerminal, s.billingFrequency))}</span> },
            { key: "next", header: "Next billing", sortValue: (s) => s.nextBillingDate, render: (s) => formatDate(s.nextBillingDate) },
            { key: "status", header: "Status", sortValue: (s) => s.status, render: (s) => <StatusBadge status={s.status} /> },
            { key: "actions", header: "", align: "right", render: (s) => (
              <RowMenu label={`Actions for ${name(s.customerId)}`} items={[
                { label: "Edit", onSelect: () => setForm({ sub: s }) },
                { label: "Create invoice", onSelect: () => setInvoiceFor(s.customerId), hidden: s.status === "CANCELLED" },
              ]} />
            ) },
          ]}
        />
      )}
      {form && data && <SubscriptionFormModal customers={data.customers} settings={data.settings} subscription={form.sub} onClose={() => setForm(null)} onSaved={reload} />}
      {invoiceFor && data && <InvoiceFormModal customers={data.customers} subscriptions={data.subscriptions} settings={data.settings} presetCustomerId={invoiceFor} onClose={() => setInvoiceFor(null)} onSaved={reload} />}
    </>
  );
}
