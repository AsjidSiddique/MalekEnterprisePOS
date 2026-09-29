import { ScrollText } from "lucide-react";
import type { AuditLog } from "@/types";
import { formatDateTime } from "@/lib/utils";
import { EmptyState } from "@/components/ui/States";

export const actionLabel = (a: string) => a.replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function AuditList({ logs }: { logs: AuditLog[] }) {
  if (logs.length === 0) return <EmptyState icon={ScrollText} title="No activity yet" description="Changes made in the admin panel will be listed here." />;
  return (
    <ol className="divide-y divide-line rounded-panel border border-line bg-surface">
      {logs.map((l) => (
        <li key={l.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-sm">
          <span className="font-medium text-ink-900">{actionLabel(l.action)}</span>
          {l.targetLabel && <span className="text-ink-700">{l.targetLabel}</span>}
          <span className="ml-auto text-xs text-muted">{l.userEmail || "system"} · {formatDateTime(l.createdAt)}</span>
        </li>
      ))}
    </ol>
  );
}
