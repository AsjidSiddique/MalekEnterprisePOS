"use client";

import { ScrollText } from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/States";
import { actionLabel } from "@/components/admin/AuditList";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatDateTime } from "@/lib/utils";
import { listAuditLogs } from "@/services/auditService";

const AREAS = ["billing", "auth", "customer", "subscription", "invoice", "license", "terminal", "release", "pricing", "settings", "notification"];

export default function AuditLogsPage() {
  const { data, loading, error, reload } = useAsyncData(() => listAuditLogs(500), []);
  return (
    <>
      <PageHeader title="Audit logs" description="A permanent record of who did what. Entries can't be edited or deleted." />
      {error ? <ErrorState title="Couldn't load the audit log" error={error} onRetry={reload} /> : loading && !data ? <TableSkeleton rows={8} /> : data && (
        <DataTable
          caption="Audit log" csv={{ filename: "audit-log", columns: [{ header: "When", value: (l) => l.createdAt }, { header: "Admin", value: (l) => l.userEmail }, { header: "Action", value: (l) => l.action }, { header: "Target", value: (l) => l.targetLabel }] }} rows={data} rowKey={(l) => l.id} pageSize={15} searchPlaceholder="Search the log" searchText={(l) => `${l.action} ${l.userEmail} ${l.targetLabel} ${JSON.stringify(l.metadata)}`}
          filters={[{ key: "area", label: "Area", options: AREAS.map((a) => ({ value: a, label: a.charAt(0).toUpperCase() + a.slice(1) })), predicate: (l, v) => l.action.startsWith(`${v}.`) }]}
          empty={<EmptyState icon={ScrollText} title="Nothing recorded yet" description="Sign-ins and every change made in the admin panel are logged here." />}
          columns={[
            { key: "when", header: "When", sortValue: (l) => l.createdAt ?? "", render: (l) => <span className="whitespace-nowrap text-muted">{formatDateTime(l.createdAt)}</span> },
            { key: "who", header: "Admin", render: (l) => l.userEmail || "system" },
            { key: "action", header: "Action", sortValue: (l) => l.action, render: (l) => <span className="font-medium">{actionLabel(l.action)}</span> },
            { key: "target", header: "Target", render: (l) => l.targetLabel || l.targetId },
            { key: "details", header: "Details", render: (l) => Object.keys(l.metadata).length === 0 ? <span className="text-muted">—</span> : (
              <details className="max-w-xs"><summary className="cursor-pointer text-xs text-muted hover:text-ink-900">View</summary><pre className="mt-1 overflow-x-auto rounded-field bg-paper p-2 font-receipt text-[11px]">{JSON.stringify(l.metadata, null, 2)}</pre></details>
            ) },
          ]}
        />
      )}
    </>
  );
}
