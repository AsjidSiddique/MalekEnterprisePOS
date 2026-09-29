"use client";

import { Download } from "lucide-react";
import { MonthBars } from "@/components/admin/charts";
import { Button } from "@/components/ui/Button";
import { downloadCsv } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useAsyncData";
import { buildReports } from "@/lib/reports";
import { cn, formatZAR } from "@/lib/utils";
import { listCustomers } from "@/services/customerService";
import { listInvoices } from "@/services/invoiceService";
import { listPayments } from "@/services/paymentService";
import { listSubscriptions } from "@/services/subscriptionService";

const AGE_TONE = ["bg-ink-400", "bg-warn", "bg-signal", "bg-bad"];

export default function ReportsPage() {
  const { data, loading, error, reload } = useAsyncData(async () => {
    const [customers, subscriptions, invoices, payments] = await Promise.all([listCustomers(), listSubscriptions(), listInvoices(), listPayments()]);
    return buildReports({ customers, subscriptions, invoices, payments });
  }, []);

  const header = (
    <PageHeader title="Reports" description="Recurring revenue, who owes what, and who your best customers are. Recurring figures exclude VAT."
      actions={data && <Button variant="secondary" onClick={() => downloadCsv({ filename: "revenue-by-month", columns: [{ header: "Month", value: (r) => r.key }, { header: "Received (ZAR)", value: (r) => r.value }] }, data.revenueByMonth)}><Download className="h-4 w-4" aria-hidden />Export revenue</Button>} />
  );
  if (error) return <>{header}<ErrorState title="Couldn't build the reports" error={error} onRetry={reload} /></>;
  if (loading && !data) return <>{header}<div className="grid gap-5 lg:grid-cols-4"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div></>;
  if (!data) return null;

  const ageMax = Math.max(...data.ageing.map((a) => a.amount), 1);
  const topMax = Math.max(...data.topCustomers.map((c) => c.amount), 1);
  const kpis = [
    ["Monthly recurring revenue", formatZAR(data.mrr), `${data.payingCustomers} paying customer${data.payingCustomers === 1 ? "" : "s"}`],
    ["Annualised", formatZAR(data.arr), "Monthly recurring × 12"],
    ["Average per customer", formatZAR(data.arpu), `${formatZAR(data.perTerminal)} per till`],
    ["Collected so far", `${data.collectionRate}%`, `${formatZAR(data.collected)} of ${formatZAR(data.billed)} billed`],
  ];

  return (
    <>
      {header}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(([label, value, hint], i) => (
          <div key={label} className={cn("rounded-xl2 p-5 shadow-card", i === 0 ? "bg-ink-900 text-white" : "border border-line bg-surface")}>
            <p className={cn("text-sm", i === 0 ? "text-ink-200" : "text-muted")}>{label}</p>
            <p className="mt-3 font-display text-[30px] font-extrabold leading-none tabular">{value}</p>
            <p className={cn("mt-2 text-xs", i === 0 ? "text-ink-300" : "text-muted")}>{hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-12">
        <section className="rounded-xl3 border border-line bg-surface p-6 shadow-card lg:col-span-7">
          <h2 className="font-display text-xl font-bold">Revenue received</h2><p className="text-sm text-muted">Last 12 months</p>
          <div className="mt-4"><MonthBars data={data.revenueByMonth} money height={260} /></div>
        </section>

        <section className="rounded-xl3 border border-line bg-surface p-6 shadow-card lg:col-span-5">
          <h2 className="font-display text-xl font-bold">Who owes what</h2><p className="text-sm text-muted">Unpaid invoices by how late they are, VAT included</p>
          <ul className="mt-5 space-y-4">
            {data.ageing.map((a, i) => (
              <li key={a.label}>
                <div className="mb-1.5 flex items-baseline justify-between text-sm"><span className="font-medium">{a.label}</span><span className="tabular"><b>{formatZAR(a.amount)}</b> <span className="text-muted">({a.count})</span></span></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-ink-100"><div className={cn("h-full rounded-full", AGE_TONE[i])} style={{ width: `${(a.amount / ageMax) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
          <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5 text-sm">
            <div><dt className="text-muted">At risk</dt><dd className="font-display text-2xl font-bold tabular">{data.atRisk}</dd><dd className="text-xs text-muted">overdue or suspended</dd></div>
            <div><dt className="text-muted">Cancelled</dt><dd className="font-display text-2xl font-bold tabular">{data.churned}</dd><dd className="text-xs text-muted">subscriptions</dd></div>
          </dl>
        </section>

        <section className="rounded-xl3 border border-line bg-surface p-6 shadow-card lg:col-span-12">
          <h2 className="font-display text-xl font-bold">Best customers</h2><p className="text-sm text-muted">By total received, all time</p>
          {data.topCustomers.length === 0 ? <p className="py-10 text-center text-sm text-muted">Payments will show here once customers start paying.</p> : (
            <ol className="mt-5 grid gap-x-10 gap-y-4 md:grid-cols-2">
              {data.topCustomers.map((c, i) => (
                <li key={c.id} className="flex items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink-100 text-xs font-bold text-ink-700">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate font-medium">{c.name}</span><span className="font-semibold tabular">{formatZAR(c.amount)}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-gradient-to-r from-ink-700 to-ink-500" style={{ width: `${(c.amount / topMax) * 100}%` }} /></div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
