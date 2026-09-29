"use client";

import { Monitor } from "lucide-react";
import { useState } from "react";
import type { License, Terminal, TerminalStatus } from "@/types";
import { StatusBadge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { errorMessage, formatDateTime } from "@/lib/utils";
import { setTerminalStatus } from "@/services/terminalService";
import { useActor } from "./AuthProvider";
import { RowMenu } from "./RowMenu";

interface Props {
  terminals: Terminal[];
  licenses: License[];
  customerName: (id: string) => string;
  onChanged: () => void;
  showCustomer?: boolean;
}

const COPY: Record<TerminalStatus, { title: string; text: string; label: string; danger: boolean }> = {
  DISABLED: { title: "Disable terminal", label: "Disable", danger: true, text: "The till is blocked at its next check-in but keeps its place on the licence. You can reactivate it." },
  REVOKED: { title: "Revoke terminal", label: "Revoke", danger: true, text: "The till is unlinked and frees a terminal slot. To use that PC again it must register from scratch." },
  ACTIVE: { title: "Reactivate terminal", label: "Reactivate", danger: false, text: "The till can trade again, provided the customer is within their terminal limit." },
};

export function TerminalTable({ terminals, licenses, customerName, onChanged, showCustomer = true }: Props) {
  const toast = useToast();
  const actor = useActor();
  const [target, setTarget] = useState<{ terminal: Terminal; to: TerminalStatus } | null>(null);
  const prefix = (id: string) => licenses.find((l) => l.id === id)?.tokenPrefix ?? "—";

  return (
    <>
      <DataTable
        caption="Terminals" csv={{ filename: "terminals", columns: [{ header: "Device", value: (t) => t.deviceName }, { header: "Customer", value: (t) => customerName(t.customerId) }, { header: "Shop", value: (t) => t.shopName }, { header: "Status", value: (t) => t.status }, { header: "Version", value: (t) => t.version }, { header: "Last seen", value: (t) => t.lastSeenAt }] }} rows={terminals} rowKey={(t) => t.id} searchPlaceholder="Search terminals"
        searchText={(t) => `${t.deviceName} ${customerName(t.customerId)} ${t.shopName} ${t.hardwareIdShort}`}
        filters={[{ key: "status", label: "Status", options: ["ACTIVE", "DISABLED", "REVOKED"].map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() })), predicate: (t, v) => t.status === v }]}
        empty={<EmptyState icon={Monitor} title="No terminals registered" description="Terminals appear here when a till activates itself with a licence key." />}
        columns={[
          { key: "device", header: "Device", sortValue: (t) => t.deviceName, render: (t) => <div><p className="font-medium">{t.deviceName}</p><p className="font-receipt text-[11px] text-muted">{t.hardwareIdShort}</p></div> },
          ...(showCustomer ? [{ key: "customer", header: "Customer", sortValue: (t: Terminal) => customerName(t.customerId), render: (t: Terminal) => customerName(t.customerId) }] : []),
          { key: "shop", header: "Shop", render: (t) => t.shopName || "—" },
          { key: "license", header: "Licence", render: (t) => <code className="font-receipt text-xs">{prefix(t.licenseId)}</code> },
          { key: "status", header: "Status", sortValue: (t) => t.status, render: (t) => <StatusBadge status={t.status} /> },
          { key: "seen", header: "Last seen", sortValue: (t) => t.lastSeenAt ?? "", render: (t) => <span className="text-muted">{formatDateTime(t.lastSeenAt)}</span> },
          { key: "version", header: "Version", render: (t) => t.version || "—" },
          { key: "actions", header: "", align: "right", render: (t) => (
            <RowMenu label={`Actions for ${t.deviceName}`} items={[
              { label: "Reactivate", onSelect: () => setTarget({ terminal: t, to: "ACTIVE" }), hidden: t.status === "ACTIVE" },
              { label: "Disable", onSelect: () => setTarget({ terminal: t, to: "DISABLED" }), hidden: t.status !== "ACTIVE" },
              { label: "Revoke (unlink)", danger: true, onSelect: () => setTarget({ terminal: t, to: "REVOKED" }), hidden: t.status === "REVOKED" },
            ]} />
          ) },
        ]}
      />
      <ConfirmDialog
        open={Boolean(target)} title={target ? COPY[target.to].title : ""} tone={target && COPY[target.to].danger ? "danger" : "primary"}
        confirmLabel={target ? COPY[target.to].label : ""} description={target ? COPY[target.to].text : ""}
        details={target ? [{ label: "Device", value: target.terminal.deviceName }, { label: "Customer", value: customerName(target.terminal.customerId) }, { label: "Now", value: target.terminal.status }] : []}
        onClose={() => setTarget(null)}
        onConfirm={async () => {
          if (!target) return;
          try {
            await setTerminalStatus(actor, target.terminal, target.to);
            toast.success(`${target.terminal.deviceName} ${target.to === "ACTIVE" ? "reactivated" : target.to === "DISABLED" ? "disabled" : "revoked"}.`);
            setTarget(null);
            onChanged();
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </>
  );
}
