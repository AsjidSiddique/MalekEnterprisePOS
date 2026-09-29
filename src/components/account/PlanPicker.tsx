"use client";

import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import type { BillingFrequency, PricingPlan } from "@/types";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { accountFetch } from "@/lib/account-client";
import { MAX_ORDER_TERMINALS } from "@/lib/account/order";
import { formatZAR } from "@/lib/utils";
import { MONTHS_PER_CYCLE } from "@/lib/billing/lifecycle";

const FREQ_LABEL: Record<BillingFrequency, string> = { monthly: "Monthly", quarterly: "Quarterly", annual: "Annual" };

interface Props {
  plans: PricingPlan[];
  billingFrequency: BillingFrequency;
  vatRate: number;
  customPrice: number | null;
  needsBusinessDetails: boolean;
  onOrdered: () => void;
}

/** Buy or upgrade a plan. A customer's own negotiated per-terminal price (set by an admin) always wins over the plan's listed price - shown clearly so nobody is confused why the total differs from the public pricing page. */
export function PlanPicker({ plans, billingFrequency, vatRate, customPrice, needsBusinessDetails, onOrdered }: Props) {
  const toast = useToast();
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [terminals, setTerminals] = useState(plans[0]?.minTerminals ?? 1);
  const [frequency, setFrequency] = useState<BillingFrequency>(billingFrequency);
  const [businessName, setBusinessName] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const plan = plans.find((p) => p.id === planId) ?? plans[0];

  const totals = useMemo(() => {
    if (!plan) return null;
    const price = customPrice ?? plan.pricePerTerminal;
    const subtotal = price * Math.max(1, terminals) * MONTHS_PER_CYCLE[frequency];
    const vat = subtotal * vatRate;
    return { price, subtotal, vat, total: subtotal + vat };
  }, [plan, terminals, frequency, vatRate, customPrice]);

  if (!plans.length) return <p className="rounded-xl3 border border-line bg-surface p-6 text-sm text-muted">No plans are available to buy right now. Please check back soon or contact us.</p>;

  const submit = async () => {
    if (!plan) return;
    if (terminals < plan.minTerminals) return toast.error(`${plan.name} starts at ${plan.minTerminals} till${plan.minTerminals === 1 ? "" : "s"}.`);
    if (needsBusinessDetails && businessName.trim().length < 2) return toast.error("Enter your business name.");
    setBusy(true);
    try {
      await accountFetch("/api/account/order", { planId: plan.id, terminals, billingFrequency: frequency, businessName, name, phone });
      toast.success("Your invoice is ready below. Pay it to activate your licence.");
      onOrdered();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create that order.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 rounded-xl3 border border-line bg-surface p-6 shadow-card sm:p-8">
      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map((p) => (
          <button key={p.id} type="button" onClick={() => { setPlanId(p.id); setTerminals(Math.max(terminals, p.minTerminals)); }}
            className={`rounded-field border p-4 text-left transition ${p.id === planId ? "border-accent-strong bg-accent/10 ring-1 ring-accent-strong" : "border-line hover:border-ink-300"}`}>
            <div className="flex items-center justify-between"><span className="font-display font-bold text-ink-900">{p.name}</span>{p.highlighted && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-ink">Popular</span>}</div>
            <p className="mt-1 text-sm text-muted">{p.description}</p>
            <p className="mt-2 text-sm font-semibold text-ink-800">{formatZAR(customPrice ?? p.pricePerTerminal)} / till / month</p>
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Number of tills" type="number" min={plan?.minTerminals ?? 1} max={MAX_ORDER_TERMINALS} value={terminals} onChange={(e) => setTerminals(Math.max(1, Math.min(MAX_ORDER_TERMINALS, Number(e.target.value) || 1)))} />
        <SelectField label="Billing" value={frequency} onChange={(e) => setFrequency(e.target.value as BillingFrequency)} options={(Object.keys(FREQ_LABEL) as BillingFrequency[]).map((f) => ({ value: f, label: FREQ_LABEL[f] }))} />
      </div>
      {needsBusinessDetails && (
        <div className="grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
          <TextField label="Business name" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="sm:col-span-2" />
          <TextField label="Your name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      )}
      {totals && (
        <div className="space-y-1 rounded-field bg-ink-50 p-4 text-sm">
          <div className="flex justify-between text-muted"><span>{formatZAR(totals.price)} x {terminals} till{terminals === 1 ? "" : "s"} x {MONTHS_PER_CYCLE[frequency]} month{MONTHS_PER_CYCLE[frequency] === 1 ? "" : "s"}</span><span>{formatZAR(totals.subtotal)}</span></div>
          <div className="flex justify-between text-muted"><span>VAT ({Math.round(vatRate * 100)}%)</span><span>{formatZAR(totals.vat)}</span></div>
          <div className="flex justify-between border-t border-line pt-1 text-base font-bold text-ink-900"><span>Total due now</span><span>{formatZAR(totals.total)}</span></div>
          {customPrice != null && <p className="flex items-center gap-1 pt-1 text-xs text-accent-strong"><Check className="h-3.5 w-3.5" /> Your account has a custom price - already applied above.</p>}
        </div>
      )}
      <Button size="lg" className="w-full" loading={busy} onClick={submit}>Create invoice</Button>
    </div>
  );
}
