"use client";

import { LogOut, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { BillingFrequency, Invoice, Payment, PricingPlan } from "@/types";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { CardsSkeleton, ErrorState } from "@/components/ui/States";
import { accountFetch } from "@/lib/account-client";
import { useCustomerAuth } from "@/lib/account/useCustomerAuth";
import { formatDate, formatZAR } from "@/lib/utils";
import { AuthGate } from "./AuthGate";
import { VerifyEmailGate } from "./VerifyEmailGate";
import { PlanPicker } from "./PlanPicker";
import { LicenseCard } from "./LicenseCard";
import { InvoiceList } from "./InvoiceList";

interface Portal {
  customer: { id: string; businessName: string; name: string; email: string; phone: string; plan: string; terminals: number; status: string; subscriptionStatus: string } | null;
  subscription: { id: string; plan: string; terminalLimit: number; status: string; nextBillingDate: string; billingFrequency: BillingFrequency } | null;
  licenses: { id: string; tokenPrefix: string; state: string; expiryDate: string; terminalLimit: number; revoked: boolean; lastVerifiedAt: string | null }[];
  invoices: (Invoice & { orderKind: string })[];
  payments: Payment[];
  terminals: { id: string; deviceName: string; shopName: string; status: string; lastSeenAt: string | null; version: string }[];
  plans: PricingPlan[];
  billingFrequency: BillingFrequency;
  vatRate: number;
  customPrice: number | null;
  canTestPay: boolean;
  supportEmail: string;
}

export function AccountPortal() {
  const auth = useCustomerAuth();
  const [portal, setPortal] = useState<Portal | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    accountFetch<Portal>("/api/account/me", undefined, "GET")
      .then(setPortal)
      .catch((e) => { console.error("[AccountPortal] load failed:", e); setError(e instanceof Error ? e : new Error(String(e))); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (auth.status === "signed-in" && auth.emailVerified) load();
  }, [auth.status, auth.emailVerified, load]);

  if (auth.status === "loading") return <CardsSkeleton count={3} />;
  if (auth.status === "signed-out") return <AuthGate />;
  if (!auth.emailVerified) return <VerifyEmailGate email={auth.user?.email ?? ""} />;
  if (loading && !portal) return <CardsSkeleton count={3} />;
  if (error) return <ErrorState title="Couldn't load your account" error={error} onRetry={load} />;
  if (!portal) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl3 border border-line bg-surface p-4">
        <span className="text-sm text-muted">Signed in as <strong className="text-ink-800">{portal.customer?.email ?? auth.user?.email}</strong></span>
        <Button variant="ghost" size="sm" onClick={() => auth.signOut()}><LogOut className="h-4 w-4" /> Sign out</Button>
      </div>

      {portal.customer?.status === "inactive" && (
        <div className="flex items-start gap-3 rounded-xl3 border border-bad/30 bg-bad/10 p-4 text-sm text-[#A22B3B]">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <span>This account is inactive. {portal.supportEmail ? <>Contact <a className="underline" href={`mailto:${portal.supportEmail}`}>{portal.supportEmail}</a> to reactivate it.</> : "Contact support to reactivate it."}</span>
        </div>
      )}

      {!portal.customer || !portal.subscription ? (
        <>
          {portal.customer && <p className="text-sm text-muted">Welcome back, {portal.customer.businessName}. Choose a plan below to get your licence.</p>}
          <PlanPicker plans={portal.plans} billingFrequency={portal.billingFrequency} vatRate={portal.vatRate} customPrice={portal.customPrice} needsBusinessDetails={!portal.customer} onOrdered={load} />
        </>
      ) : (
        <div className="rounded-xl3 border border-line bg-surface p-6 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-display text-xl font-bold text-ink-900">{portal.customer.businessName}</h2><p className="text-sm text-muted">{portal.subscription.plan} - {portal.subscription.terminalLimit} till{portal.subscription.terminalLimit === 1 ? "" : "s"}</p></div>
            <StatusBadge status={portal.subscription.status} />
          </div>
          <p className="mt-3 text-sm text-muted">Next billing date: <strong className="text-ink-800">{formatDate(portal.subscription.nextBillingDate)}</strong></p>
          {portal.subscription.status !== "CANCELLED" && (
            <div className="mt-5 border-t border-line pt-5">
              <p className="mb-3 text-sm font-semibold text-ink-800">Need more tills, or want to switch plans?</p>
              <PlanPicker plans={portal.plans} billingFrequency={portal.subscription.billingFrequency} vatRate={portal.vatRate} customPrice={portal.customPrice} needsBusinessDetails={false} onOrdered={load} />
            </div>
          )}
        </div>
      )}

      {portal.licenses.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-display text-lg font-bold text-ink-900">Your licence{portal.licenses.length === 1 ? "" : "s"}</h2>
          {portal.licenses.map((l) => <LicenseCard key={l.id} license={l} />)}
        </div>
      )}

      {portal.terminals.length > 0 && (
        <div className="overflow-hidden rounded-xl3 border border-line bg-surface shadow-card">
          <h2 className="border-b border-line px-6 py-4 font-display text-lg font-bold text-ink-900">Registered tills</h2>
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-50 text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-3">Device</th><th className="px-4 py-3">Shop</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Last seen</th></tr></thead>
            <tbody className="divide-y divide-line">
              {portal.terminals.map((t) => (
                <tr key={t.id}><td className="px-4 py-3 font-medium text-ink-900">{t.deviceName || "(unnamed)"}</td><td className="px-4 py-3 text-muted">{t.shopName}</td><td className="px-4 py-3"><StatusBadge status={t.status} /></td><td className="px-4 py-3 text-muted">{t.lastSeenAt ? formatDate(t.lastSeenAt) : "Never"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-display text-lg font-bold text-ink-900">Invoices</h2>
        <InvoiceList invoices={portal.invoices} canTestPay={portal.canTestPay} onPaid={load} />
      </div>

      {portal.payments.length > 0 && (
        <div className="overflow-hidden rounded-xl3 border border-line bg-surface shadow-card">
          <h2 className="border-b border-line px-6 py-4 font-display text-lg font-bold text-ink-900">Payment history</h2>
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-50 text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Method</th></tr></thead>
            <tbody className="divide-y divide-line">
              {portal.payments.map((p) => (
                <tr key={p.id}><td className="px-4 py-3 text-muted">{p.paidAt ? formatDate(p.paidAt) : "-"}</td><td className="px-4 py-3 font-semibold text-ink-800">{formatZAR(p.amount)}</td><td className="px-4 py-3 text-muted capitalize">{p.method.replace("_", " ")}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
