"use client";

import { FileText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { Invoice, InvoiceStatus } from "@/types";
import { StatusBadge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { checkTransition } from "@/lib/billing/invoiceRules";
import { errorMessage, formatDate, formatZAR } from "@/lib/utils";
import { setInvoiceStatus } from "@/services/invoiceService";
import { useActor } from "./AuthProvider";
import { MarkPaidModal } from "./MarkPaidModal";
import { RowMenu } from "./RowMenu";

interface Props {
  invoices: Invoice[];
  customerName: (id: string) => string;
  onChanged: () => void;
  showCustomer?: boolean;
  toolbar?: ReactNode;
  emptyAction?: ReactNode;
}

const STATUS_VERB: Record<Exclude<InvoiceStatus, "PAID">, string> = { PENDING: "Mark as pending", OVERDUE: "Mark as overdue", CANCELLED: "Cancel invoice" };

export function InvoiceTable({ invoices, customerName, onChanged, showCustomer = true, toolbar, emptyAction }: Props) {
  const router = useRouter();
  const toast = useToast();
  const actor = useActor();
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);
  const [change, setChange] = useState<{ invoice: Invoice; to: Exclude<InvoiceStatus, "PAID"> } | null>(null);

  const canMove = (i: Invoice, to: InvoiceStatus) => checkTransition(i.status, to).ok;

  return (
    <>
      <DataTable
        caption="Invoices" csv={{ filename: "invoices", columns: [{ header: "Invoice", value: (i) => i.number }, { header: "Customer", value: (i) => customerName(i.customerId) }, { header: "Issued", value: (i) => i.issueDate }, { header: "Due", value: (i) => i.dueDate }, { header: "Subtotal (ZAR)", value: (i) => i.subtotal }, { header: "VAT (ZAR)", value: (i) => i.vatAmount }, { header: "Total (ZAR)", value: (i) => i.total }, { header: "Status", value: (i) => i.status }, { header: "Paid on", value: (i) => i.paidAt?.slice(0, 10) }] }} rows={invoices} rowKey={(i) => i.id} pageSize={12} toolbar={toolbar}
        searchPlaceholder="Search invoices"
        searchText={(i) => `${i.number} ${customerName(i.customerId)}`}
        onRowClick={(i) => router.push(`/admin/invoices/${i.id}`)}
        filters={[{ key: "status", label: "Status", options: ["PENDING", "PAID", "OVERDUE", "CANCELLED"].map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() })), predicate: (i, v) => i.status === v }]}
        empty={<EmptyState icon={FileText} title="No invoices yet" description="Invoices are created automatically on each billing date, or you can create one by hand." action={emptyAction} />}
        columns={[
          { key: "number", header: "Invoice", sortValue: (i) => i.number, render: (i) => <Link href={`/admin/invoices/${i.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-ink-900 hover:underline">{i.number}</Link> },
          ...(showCustomer ? [{ key: "customer", header: "Customer", sortValue: (i: Invoice) => customerName(i.customerId), render: (i: Invoice) => customerName(i.customerId) }] : []),
          { key: "issued", header: "Issued", sortValue: (i) => i.issueDate, render: (i) => formatDate(i.issueDate) },
          { key: "due", header: "Due", sortValue: (i) => i.dueDate, render: (i) => formatDate(i.dueDate) },
          { key: "total", header: "Total", align: "right", sortValue: (i) => i.total, render: (i) => formatZAR(i.total) },
          { key: "status", header: "Status", sortValue: (i) => i.status, render: (i) => <StatusBadge status={i.status} /> },
          { key: "actions", header: "", align: "right", render: (i) => (
            <RowMenu label={`Actions for ${i.number}`} items={[
              { label: "Mark as paid", onSelect: () => setPayTarget(i), hidden: !canMove(i, "PAID") },
              { label: STATUS_VERB.PENDING, onSelect: () => setChange({ invoice: i, to: "PENDING" }), hidden: !canMove(i, "PENDING") },
              { label: STATUS_VERB.OVERDUE, onSelect: () => setChange({ invoice: i, to: "OVERDUE" }), hidden: !canMove(i, "OVERDUE") },
              { label: STATUS_VERB.CANCELLED, danger: true, onSelect: () => setChange({ invoice: i, to: "CANCELLED" }), hidden: !canMove(i, "CANCELLED") },
              { label: "View / print", onSelect: () => router.push(`/admin/invoices/${i.id}`) },
            ]} />
          ) },
        ]}
      />

      {payTarget && <MarkPaidModal invoice={payTarget} customerName={customerName(payTarget.customerId)} onClose={() => setPayTarget(null)} onDone={onChanged} />}

      <ConfirmDialog
        open={Boolean(change)}
        title={change ? STATUS_VERB[change.to] : ""}
        tone={change?.to === "CANCELLED" || change?.invoice.status === "PAID" ? "danger" : "primary"}
        confirmLabel="Confirm"
        description={change?.invoice.status === "PAID" ? "This invoice is currently paid. Reverting it flags its payment as refunded and can suspend the subscription again." : "This changes the invoice and may change the subscription status."}
        details={change ? [{ label: "Invoice", value: change.invoice.number }, { label: "Customer", value: customerName(change.invoice.customerId) }, { label: "Amount", value: formatZAR(change.invoice.total) }, { label: "Change", value: `${change.invoice.status} → ${change.to}` }] : []}
        onClose={() => setChange(null)}
        onConfirm={async () => {
          if (!change) return;
          try {
            await setInvoiceStatus(actor, change.invoice, change.to, { confirmed: true });
            toast.success(`${change.invoice.number} updated.`);
            setChange(null);
            onChanged();
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </>
  );
}
