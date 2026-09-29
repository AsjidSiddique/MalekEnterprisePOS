"use client";

import { Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { InvoiceFormModal } from "@/components/admin/InvoiceFormModal";
import { InvoiceTable } from "@/components/admin/InvoiceTable";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState, TableSkeleton } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useAsyncData";
import { listCustomers } from "@/services/customerService";
import { listInvoices } from "@/services/invoiceService";
import { getSettings } from "@/services/settingsService";
import { listSubscriptions } from "@/services/subscriptionService";

function InvoicesView() {
  const params = useSearchParams();
  const { data, loading, error, reload } = useAsyncData(async () => {
    const [invoices, customers, subscriptions, settings] = await Promise.all([listInvoices(), listCustomers(), listSubscriptions(), getSettings()]);
    return { invoices, customers, subscriptions, settings };
  }, []);
  const [creating, setCreating] = useState(false);
  useEffect(() => { if (params.get("new") === "1") setCreating(true); }, [params]);
  const name = (id: string) => data?.customers.find((c) => c.id === id)?.businessName ?? "Unknown customer";
  const add = <Button variant="dark" onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden />New invoice</Button>;

  return (
    <>
      <PageHeader title="Invoices" description="Track what's been billed and what's been paid." actions={add} />
      {error ? <ErrorState title="Couldn't load invoices" error={error} onRetry={reload} /> : loading && !data ? <TableSkeleton /> : data && (
        <InvoiceTable invoices={data.invoices} customerName={name} onChanged={reload} emptyAction={add} />
      )}
      {creating && data && <InvoiceFormModal customers={data.customers} subscriptions={data.subscriptions} settings={data.settings} onClose={() => setCreating(false)} onSaved={reload} />}
    </>
  );
}

export default function InvoicesPage() {
  return <Suspense fallback={<TableSkeleton />}><InvoicesView /></Suspense>;
}
