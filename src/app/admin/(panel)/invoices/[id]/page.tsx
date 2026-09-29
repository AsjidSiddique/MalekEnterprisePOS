"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { MarkPaidModal, METHOD_LABEL } from "@/components/admin/MarkPaidModal";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useAsyncData";
import { checkTransition } from "@/lib/billing/invoiceRules";
import { formatDate, formatDateTime, formatZAR } from "@/lib/utils";
import { getCustomer } from "@/services/customerService";
import { getInvoice } from "@/services/invoiceService";
import { getSettings } from "@/services/settingsService";

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, reload } = useAsyncData(async () => {
    const invoice = await getInvoice(id);
    const [customer, settings] = await Promise.all([invoice ? getCustomer(invoice.customerId) : null, getSettings()]);
    return { invoice, customer, settings };
  }, [id]);
  const [paying, setPaying] = useState(false);

  if (error) return <ErrorState title="Couldn't load this invoice" error={error} onRetry={reload} />;
  if (loading && !data) return <Skeleton className="h-[32rem]" />;
  if (!data?.invoice) return <ErrorState title="Invoice not found" error="It may have been removed." />;
  const { invoice, customer, settings } = data;
  const customerName = customer?.businessName ?? "Unknown customer";

  return (
    <>
      <div className="no-print mb-5 flex flex-wrap items-center gap-2">
        <Link href="/admin/invoices" className="mr-auto inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink-900"><ArrowLeft className="h-4 w-4" aria-hidden />All invoices</Link>
        {checkTransition(invoice.status, "PAID").ok && <Button variant="primary" onClick={() => setPaying(true)}>Mark as paid</Button>}
        <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden />Print / save as PDF</Button>
      </div>

      <article className="panel print-area mx-auto max-w-3xl p-8 sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
          <div>
            <p className="font-display text-2xl font-semibold">{settings.general.productName}</p>
            {settings.general.supportEmail && <p className="text-sm text-muted">{settings.general.supportEmail}</p>}
          </div>
          <div className="text-right">
            <h1 className="font-display text-3xl font-semibold tracking-tight">Invoice</h1>
            <p className="font-receipt text-sm">{invoice.number}</p>
            <div className="mt-2"><StatusBadge status={invoice.status} /></div>
          </div>
        </header>

        <section className="grid gap-6 py-6 sm:grid-cols-2">
          <div>
            <h2 className="text-xs font-semibold text-muted">Billed to</h2>
            <p className="mt-1 font-medium">{customerName}</p>
            {customer && <p className="text-sm text-ink-700">{customer.name}<br />{customer.email}{customer.address && <><br />{customer.address}</>}</p>}
          </div>
          <dl className="grid grid-cols-2 gap-y-1 text-sm sm:justify-items-end">
            <dt className="text-muted">Issued</dt><dd className="tabular">{formatDate(invoice.issueDate)}</dd>
            <dt className="text-muted">Due</dt><dd className="tabular">{formatDate(invoice.dueDate)}</dd>
          </dl>
        </section>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead><tr className="border-y border-line text-left text-xs text-muted"><th className="py-2 font-semibold">Description</th><th className="py-2 text-right font-semibold">Qty</th><th className="py-2 text-right font-semibold">Unit price</th><th className="py-2 text-right font-semibold">Amount</th></tr></thead>
            <tbody className="divide-y divide-line tabular">
              {invoice.lines.map((l, i) => (
                <tr key={i}><td className="py-3 pr-4">{l.description}</td><td className="py-3 text-right">{l.quantity}</td><td className="py-3 text-right">{formatZAR(l.unitPrice)}</td><td className="py-3 text-right">{formatZAR(l.quantity * l.unitPrice)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="ml-auto mt-6 max-w-xs space-y-1.5 text-sm tabular">
          <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatZAR(invoice.subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">VAT ({Math.round(invoice.vatRate * 100)}%)</dt><dd>{formatZAR(invoice.vatAmount)}</dd></div>
          <div className="flex justify-between border-t border-ink-900 pt-2 text-lg font-semibold"><dt>Total</dt><dd>{formatZAR(invoice.total)}</dd></div>
        </dl>

        {invoice.status === "PAID" && (
          <p className="mt-8 rounded-field bg-ok/10 px-4 py-3 text-sm text-[#0F6E48]">
            Paid {formatDateTime(invoice.paidAt)}{invoice.paymentMethod ? ` by ${METHOD_LABEL[invoice.paymentMethod].toLowerCase()}` : ""}{invoice.paymentNote ? `. ${invoice.paymentNote}` : ""}
          </p>
        )}
      </article>

      {paying && <MarkPaidModal invoice={invoice} customerName={customerName} onClose={() => setPaying(false)} onDone={reload} />}
    </>
  );
}
