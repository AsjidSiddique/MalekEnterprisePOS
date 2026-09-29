"use client";

import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, CreditCard, Download, Inbox, KeyRound, Monitor, PlayCircle, Rocket, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/admin/AuthProvider";
import { actionLabel } from "@/components/admin/AuditList";
import { MonthBars, RevenueArea } from "@/components/admin/charts";
import { RunBilling } from "@/components/admin/RunBilling";
import { StatCard } from "@/components/admin/StatCard";
import { Badge } from "@/components/ui/Badge";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { CardsSkeleton, ErrorState, Skeleton } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useAsyncData";
import { cn, formatZAR, timeAgo } from "@/lib/utils";
import { loadDashboard } from "@/services/dashboardService";

const STATUS_COLOR: Record<string, string> = { ACTIVE: "bg-ok", PENDING: "bg-info", OVERDUE: "bg-bad", GRACE: "bg-warn", SUSPENDED: "bg-signal", CANCELLED: "bg-ink-300" };

function greeting(h: number) { return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; }

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsyncData(loadDashboard, []);
  const [now] = useState(() => new Date());
  const name = useMemo(() => { const n = (user?.email ?? "").split("@")[0] ?? ""; return n ? n.charAt(0).toUpperCase() + n.slice(1) : ""; }, [user]);

  const header = (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm text-muted">{now.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="display-wide text-[34px] font-bold sm:text-[42px]">{greeting(now.getHours())}{name ? `, ${name}` : ""}.</h1>
      </div>
      <RunBilling onDone={reload} />
    </div>
  );

  if (error) return <>{header}<ErrorState title="Couldn't load the dashboard" error={error} onRetry={reload} /></>;
  if (loading && !data) return <>{header}<div className="space-y-5"><div className="grid gap-5 lg:grid-cols-12"><Skeleton className="h-80 lg:col-span-8" /><Skeleton className="h-80 lg:col-span-4" /></div><CardsSkeleton count={4} /></div></>;
  if (!data) return null;

  const delta = data.revenueLastMonth > 0 ? Math.round(((data.revenueThisMonth - data.revenueLastMonth) / data.revenueLastMonth) * 100) : null;
  const att = data.attention;
  const attention = [
    ...att.overdue.map((o) => ({ key: o.invoice.id, icon: AlertTriangle, tone: "bg-bad/10 text-bad", title: o.customer, sub: `${o.invoice.number}, ${o.daysLate} day${o.daysLate === 1 ? "" : "s"} late`, right: formatZAR(o.invoice.total), href: `/admin/invoices/${o.invoice.id}` })),
    ...att.expiringLicences.map((e) => ({ key: e.license.id, icon: KeyRound, tone: "bg-warn/15 text-warn", title: e.customer, sub: `Licence expires in ${e.daysLeft} day${e.daysLeft === 1 ? "" : "s"}`, right: e.license.tokenPrefix, href: "/admin/access" })),
  ].slice(0, 6);
  const total = data.subscriptionsByStatus.reduce((t, s) => t + s.value, 0) || 1;
  const latestVersion = data.cards.latestVersion;

  return (
    <>
      {header}
      <div className="grid gap-5 lg:grid-cols-12">
        <section className="relative overflow-hidden rounded-xl3 bg-ink-900 p-7 text-white shadow-lift sm:p-8 lg:col-span-8">
          <div aria-hidden className="bg-dots absolute inset-0 opacity-70" />
          <div aria-hidden className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-sm text-ink-200">Received this month</p>
              <p className="font-display text-5xl font-extrabold tabular sm:text-6xl"><span className="text-accent">R</span><AnimatedNumber value={data.revenueThisMonth} duration={1.2} format={(n) => formatZAR(n).replace("R ", "")} /></p>
              {delta !== null && (
                <p className={cn("mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", delta >= 0 ? "bg-live/15 text-live" : "bg-signal/15 text-signal")}>
                  {delta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />}{Math.abs(delta)}% vs last month
                </p>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div><dt className="text-ink-300">Monthly recurring</dt><dd className="font-display text-xl font-bold tabular">{formatZAR(data.mrr)}</dd></div>
              <div><dt className="text-ink-300">Outstanding</dt><dd className="font-display text-xl font-bold tabular">{formatZAR(data.outstanding)}</dd></div>
            </dl>
          </div>
          <div className="relative mt-4"><RevenueArea data={data.revenue} dark height={210} /></div>
        </section>

        <section className="rounded-xl3 border border-line bg-surface p-6 shadow-card lg:col-span-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Needs attention</h2>
            {attention.length > 0 && <Badge tone="bad">{attention.length}</Badge>}
          </div>
          {attention.length === 0 ? (
            <div className="grid place-items-center py-10 text-center"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-ok/12 text-ok"><Users className="h-5 w-5" aria-hidden /></span><p className="mt-3 font-semibold">All caught up</p><p className="text-sm text-muted">No overdue invoices or expiring licences.</p></div>
          ) : (
            <ul className="-mx-2 space-y-0.5">
              {attention.map((a) => (
                <li key={a.key}><Link href={a.href} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-paper">
                  <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", a.tone)}><a.icon className="h-4 w-4" aria-hidden /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{a.title}</span><span className="block truncate text-xs text-muted">{a.sub}</span></span>
                  <span className="font-receipt text-xs tabular text-ink-700">{a.right}</span>
                </Link></li>
              ))}
            </ul>
          )}
          {(att.newInquiries > 0 || att.draftReleases > 0) && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-4 text-xs">
              {att.newInquiries > 0 && <Link href="/admin/notifications" className="inline-flex items-center gap-1.5 rounded-full bg-info/10 px-3 py-1.5 font-semibold text-info"><Inbox className="h-3.5 w-3.5" aria-hidden />{att.newInquiries} new message{att.newInquiries === 1 ? "" : "s"}</Link>}
              {att.draftReleases > 0 && <Link href="/admin/releases" className="inline-flex items-center gap-1.5 rounded-full bg-ink-100 px-3 py-1.5 font-semibold text-ink-700"><Rocket className="h-3.5 w-3.5" aria-hidden />{att.draftReleases} draft release{att.draftReleases === 1 ? "" : "s"}</Link>}
            </div>
          )}
        </section>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Customers" value={data.cards.totalCustomers} icon={Users} href="/admin/customers" spark={data.newCustomers.map((p) => p.value)} hint={`${att.suspended} suspended`} tone="default" />
        <StatCard label="Active subscriptions" value={data.cards.activeSubscriptions} icon={CreditCard} href="/admin/subscriptions" spark={data.revenue.map((p) => p.value)} hint={`${data.cards.pendingPayments.count} awaiting payment`} />
        <StatCard label="Active licences" value={data.cards.activeLicenses} icon={KeyRound} href="/admin/licenses" spark={data.licenseActivity.map((p) => p.value)} />
        <StatCard label="Registered terminals" value={data.cards.registeredTerminals} icon={Monitor} href="/admin/terminals" hint="Tills across every shop" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-12">
        <section className="rounded-xl3 border border-line bg-surface p-6 shadow-card lg:col-span-5">
          <h2 className="font-display text-xl font-bold">Recent activity</h2>
          {data.recent.length === 0 ? <p className="py-10 text-center text-sm text-muted">Changes made in the admin panel appear here.</p> : (
            <ol className="relative mt-5 space-y-4 border-l-2 border-dashed border-ink-100 pl-5">
              {data.recent.map((l) => (
                <li key={l.id} className="relative">
                  <span aria-hidden className="absolute -left-[27px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-surface" />
                  <p className="text-sm"><span className="font-semibold">{actionLabel(l.action)}</span>{l.targetLabel && <span className="text-ink-700"> {l.targetLabel}</span>}</p>
                  <p className="text-xs text-muted">{l.userEmail || "system"}, {timeAgo(l.createdAt)}</p>
                </li>
              ))}
            </ol>
          )}
          <Link href="/admin/audit-logs" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900 hover:underline">Full audit log <ArrowRight className="h-4 w-4" aria-hidden /></Link>
        </section>

        <section className="rounded-xl3 border border-line bg-surface p-6 shadow-card lg:col-span-4">
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="font-display text-xl font-bold">Downloads</h2><p className="text-sm text-muted">Last 30 days</p></div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink-900 text-accent"><Download className="h-[18px] w-[18px]" aria-hidden /></span>
          </div>
          <p className="mt-3 font-display text-4xl font-extrabold tabular">{data.downloadsTotal30}</p>
          <MonthBars data={data.downloads30.map((d) => ({ label: d.day.slice(8), value: d.value }))} height={130} color="#FFC72C" />
          <div className="mt-3 flex items-center justify-between border-t border-line pt-4 text-sm">
            <span className="text-muted">Latest release</span>
            {latestVersion ? <Link href="/admin/releases" className="inline-flex items-center gap-1.5 font-semibold hover:underline"><PlayCircle className="h-4 w-4 text-accent-strong" aria-hidden />v{latestVersion}</Link> : <span className="text-muted">None published</span>}
          </div>
        </section>

        <section className="rounded-xl3 border border-line bg-surface p-6 shadow-card lg:col-span-3">
          <h2 className="font-display text-xl font-bold">Subscription health</h2>
          <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-ink-100" role="img" aria-label="Subscriptions by status">
            {data.subscriptionsByStatus.filter((s) => s.value).map((s) => <div key={s.status} className={STATUS_COLOR[s.status]} style={{ width: `${(s.value / total) * 100}%` }} title={`${s.status}: ${s.value}`} />)}
          </div>
          <ul className="mt-5 space-y-2.5 text-sm">
            {data.subscriptionsByStatus.map((s) => (
              <li key={s.status} className="flex items-center gap-2.5"><span className={cn("h-2.5 w-2.5 rounded-full", STATUS_COLOR[s.status])} aria-hidden /><span className="flex-1 text-ink-800">{s.status.charAt(0) + s.status.slice(1).toLowerCase()}</span><span className="font-semibold tabular">{s.value}</span></li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
