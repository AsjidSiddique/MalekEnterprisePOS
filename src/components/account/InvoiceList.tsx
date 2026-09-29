"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { accountFetch } from "@/lib/account-client";
import { formatDate, formatZAR } from "@/lib/utils";
import type { Invoice } from "@/types";

/** Test-mode "Pay now" only ever appears when the server itself confirms test payments are on (canTestPay) - the button is never shown, let alone usable, on a real production setup. */
export function InvoiceList({ invoices, canTestPay, onPaid }: { invoices: (Invoice & { orderKind: string })[]; canTestPay: boolean; onPaid: () => void }) {
  const toast = useToast();
  const [payingId, setPayingId] = useState<string | null>(null);

  if (!invoices.length) return <p className="rounded-xl3 border border-line bg-surface p-6 text-sm text-muted">No invoices yet.</p>;

  const pay = async (id: string) => {
    setPayingId(id);
    try {
      await accountFetch("/api/account/pay-test", { invoiceId: id });
      toast.success("Payment recorded. Your plan and licence are updating now.");
      onPaid();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't record that payment.");
    } finally {
      setPayingId(null);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl3 border border-line bg-surface shadow-card">
      <table className="w-full text-left text-sm">
        <thead className="bg-ink-50 text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Issued</th><th className="px-4 py-3">Due</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr></thead>
        <tbody className="divide-y divide-line">
          {invoices.map((inv) => (
            <tr key={inv.id}>
              <td className="px-4 py-3 font-medium text-ink-900">{inv.number}</td>
              <td className="px-4 py-3 text-muted">{formatDate(inv.issueDate)}</td>
              <td className="px-4 py-3 text-muted">{formatDate(inv.dueDate)}</td>
              <td className="px-4 py-3 font-semibold text-ink-800">{formatZAR(inv.total)}</td>
              <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
              <td className="px-4 py-3 text-right">
                {canTestPay && (inv.status === "PENDING" || inv.status === "OVERDUE") && (
                  <Button size="sm" loading={payingId === inv.id} onClick={() => pay(inv.id)}>Pay now (test)</Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
