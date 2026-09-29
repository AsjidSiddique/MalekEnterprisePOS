"use client";

import { Plus, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CustomerFormModal } from "@/components/admin/CustomerFormModal";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatDate, formatZAR } from "@/lib/utils";
import { listCustomers } from "@/services/customerService";
import { getPricing } from "@/services/pricingService";

function CustomersView() {
  const router = useRouter();
  const params = useSearchParams();
  const [adding, setAdding] = useState(false);
  useEffect(() => { if (params.get("new") === "1") setAdding(true); }, [params]);
  const { data, loading, error, reload } = useAsyncData(async () => {
    const [customers, pricing] = await Promise.all([listCustomers(), getPricing().catch(() => null)]);
    return { customers, pricing };
  }, []);

  const addButton = <Button variant="dark" onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden />Add customer</Button>;

  return (
    <>
      <PageHeader title="Customers" description="Every business that uses Malek Enterprise POS." actions={addButton} />
      {error ? <ErrorState title="Couldn't load customers" error={error} onRetry={reload} /> : loading && !data ? <TableSkeleton /> : data && (
        <DataTable
          caption="Customers" csv={{ filename: "customers", columns: [{ header: "Business", value: (c) => c.businessName }, { header: "Contact", value: (c) => c.name }, { header: "Email", value: (c) => c.email }, { header: "Phone", value: (c) => c.phone }, { header: "Terminals", value: (c) => c.terminals }, { header: "Price per terminal (ZAR)", value: (c) => c.pricePerTerminal }, { header: "Subscription", value: (c) => c.subscriptionStatus }, { header: "Status", value: (c) => c.status }, { header: "Added", value: (c) => c.createdAt?.slice(0, 10) }] }} rows={data.customers} rowKey={(c) => c.id} initialQuery={params.get("q") ?? ""} searchPlaceholder="Search customers"
          searchText={(c) => `${c.businessName} ${c.name} ${c.email} ${c.phone}`}
          onRowClick={(c) => router.push(`/admin/customers/${c.id}`)}
          filters={[
            { key: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }], predicate: (c, v) => c.status === v },
            { key: "sub", label: "Subscription", options: ["ACTIVE", "PENDING", "OVERDUE", "GRACE", "SUSPENDED", "CANCELLED", "NONE"].map((s) => ({ value: s, label: s === "NONE" ? "None" : s.charAt(0) + s.slice(1).toLowerCase() })), predicate: (c, v) => c.subscriptionStatus === v },
          ]}
          empty={<EmptyState icon={Users} title="No customers yet" description="Add your first customer to start billing and issuing licences." action={addButton} />}
          columns={[
            { key: "business", header: "Business", sortValue: (c) => c.businessName, render: (c) => <div className="flex items-center gap-3"><Avatar name={c.businessName} size="sm" /><div><p className="font-semibold text-ink-900">{c.businessName}</p><p className="text-xs text-muted">{c.name}, {c.email}</p></div></div> },
            { key: "terminals", header: "Terminals", align: "right", sortValue: (c) => c.terminals, render: (c) => c.terminals },
            { key: "price", header: "Per terminal", align: "right", sortValue: (c) => c.pricePerTerminal, render: (c) => formatZAR(c.pricePerTerminal) },
            { key: "sub", header: "Subscription", render: (c) => <StatusBadge status={c.subscriptionStatus} /> },
            { key: "status", header: "Status", sortValue: (c) => c.status, render: (c) => <StatusBadge status={c.status} /> },
            { key: "created", header: "Added", sortValue: (c) => c.createdAt ?? "", render: (c) => <span className="text-muted">{formatDate(c.createdAt)}</span> },
          ]}
        />
      )}
      {adding && <CustomerFormModal pricing={data?.pricing ?? null} onClose={() => { setAdding(false); router.replace("/admin/customers"); }} onSaved={(id) => router.push(`/admin/customers/${id}`)} />}
    </>
  );
}

export default function CustomersPage() {
  return <Suspense fallback={<TableSkeleton />}><CustomersView /></Suspense>;
}
