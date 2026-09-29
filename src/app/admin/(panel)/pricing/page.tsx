"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useActor } from "@/components/admin/AuthProvider";
import { Button } from "@/components/ui/Button";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useAsyncData } from "@/hooks/useAsyncData";
import { pricingSchema } from "@/lib/validation/schemas";
import { errorMessage, formatZAR } from "@/lib/utils";
import { listCustomers } from "@/services/customerService";
import { getPricing, savePricing, setCustomerPrice } from "@/services/pricingService";
import { listSubscriptions } from "@/services/subscriptionService";
import type { Customer } from "@/types";

interface PlanDraft { id: string; name: string; description: string; pricePerTerminal: string; minTerminals: string; features: string; highlighted: boolean }
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `plan-${Date.now()}`;

export default function PricingPage() {
  const actor = useActor();
  const toast = useToast();
  const { data, loading, error, reload } = useAsyncData(async () => {
    const [pricing, customers, subscriptions] = await Promise.all([getPricing(), listCustomers(), listSubscriptions()]);
    return { pricing, customers, subscriptions };
  }, []);

  const [draft, setDraft] = useState<{ headline: string; subtitle: string; plans: PlanDraft[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [priceFor, setPriceFor] = useState<{ customer: Customer; value: string } | null>(null);

  if (error) return <><PageHeader title="Pricing" /><ErrorState title="Couldn't load pricing" error={error} onRetry={reload} /></>;
  if (loading && !data) return <><PageHeader title="Pricing" /><Skeleton className="h-96" /></>;
  if (!data) return null;

  const form = draft ?? {
    headline: data.pricing?.headline ?? "", subtitle: data.pricing?.subtitle ?? "",
    plans: (data.pricing?.plans ?? []).map((p) => ({ id: p.id, name: p.name, description: p.description, pricePerTerminal: String(p.pricePerTerminal), minTerminals: String(p.minTerminals), features: p.features.join("\n"), highlighted: p.highlighted })),
  };
  const update = (patch: Partial<typeof form>) => setDraft({ ...form, ...patch });
  const updatePlan = (i: number, patch: Partial<PlanDraft>) => update({ plans: form.plans.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) });

  const save = async () => {
    const parsed = pricingSchema.safeParse({
      currency: "ZAR", billingFrequency: "monthly", headline: form.headline, subtitle: form.subtitle,
      plans: form.plans.map((p) => ({ id: p.id || slug(p.name), name: p.name, description: p.description, pricePerTerminal: p.pricePerTerminal, minTerminals: p.minTerminals,
        features: p.features.split("\n").map((f) => f.trim()).filter(Boolean), highlighted: p.highlighted })),
    });
    if (!parsed.success) { const i = parsed.error.issues[0]; return toast.error(`${i?.path.join(" › ")}: ${i?.message}`); }
    setSaving(true);
    try { await savePricing(actor, parsed.data); toast.success("Public pricing saved."); setDraft(null); reload(); } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  const sub = (customerId: string) => data.subscriptions.find((s) => s.customerId === customerId && s.status !== "CANCELLED");

  return (
    <>
      <PageHeader title="Pricing" description="What the public pricing page shows, and any customer who pays something different. All prices are in South African rand." />
      <div className="space-y-8">
        <section className="panel p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-base font-semibold">Public plans</h2><p className="text-sm text-muted">Shown on the website pricing page. Prices are per terminal per month.</p></div>
            <div className="flex gap-2">
              {draft && <Button variant="secondary" onClick={() => setDraft(null)}>Discard changes</Button>}
              <Button variant="dark" onClick={save} loading={saving} disabled={!draft}>Save pricing</Button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Page headline" value={form.headline} onChange={(e) => update({ headline: e.target.value })} />
            <SelectField label="Currency" value="ZAR" disabled options={[{ value: "ZAR", label: "South African rand (ZAR)" }]} hint="Fixed to rand across the whole platform." />
            <TextField label="Sub-headline" className="sm:col-span-2" value={form.subtitle} onChange={(e) => update({ subtitle: e.target.value })} />
          </div>
          <div className="mt-6 space-y-4">
            {form.plans.map((p, i) => (
              <fieldset key={p.id + i} className="rounded-panel border border-line p-4">
                <legend className="px-1 text-sm font-semibold">Plan {i + 1}</legend>
                <div className="grid gap-4 sm:grid-cols-3">
                  <TextField label="Name" value={p.name} onChange={(e) => updatePlan(i, { name: e.target.value })} />
                  <TextField label="Price per terminal (ZAR)" inputMode="decimal" value={p.pricePerTerminal} onChange={(e) => updatePlan(i, { pricePerTerminal: e.target.value })} />
                  <TextField label="Minimum terminals" inputMode="numeric" value={p.minTerminals} onChange={(e) => updatePlan(i, { minTerminals: e.target.value })} />
                  <TextField label="Description" className="sm:col-span-3" value={p.description} onChange={(e) => updatePlan(i, { description: e.target.value })} />
                  <TextAreaField label="Features (one per line)" rows={4} className="sm:col-span-2" value={p.features} onChange={(e) => updatePlan(i, { features: e.target.value })} />
                  <div className="flex flex-col justify-between">
                    <CheckboxField label="Highlight as most chosen" checked={p.highlighted} onChange={(e) => updatePlan(i, { highlighted: e.target.checked })} />
                    <Button variant="ghost" className="self-start text-[#A22B3B]" onClick={() => update({ plans: form.plans.filter((_, idx) => idx !== i) })}><Trash2 className="h-4 w-4" aria-hidden />Remove plan</Button>
                  </div>
                </div>
              </fieldset>
            ))}
            <Button variant="secondary" onClick={() => update({ plans: [...form.plans, { id: "", name: "", description: "", pricePerTerminal: "0", minTerminals: "1", features: "", highlighted: false }] })} disabled={form.plans.length >= 6}><Plus className="h-4 w-4" aria-hidden />Add plan</Button>
          </div>
        </section>

        <section>
          <h2 className="mb-1 text-base font-semibold">Customer-specific prices</h2>
          <p className="mb-3 text-sm text-muted">Change what one customer pays per terminal. It applies to their next invoice.</p>
          <DataTable
            caption="Customer prices" rows={data.customers} rowKey={(c) => c.id} searchPlaceholder="Search customers" searchText={(c) => `${c.businessName} ${c.plan}`}
            empty={<p className="px-6 py-10 text-center text-sm text-muted">No customers yet.</p>}
            columns={[
              { key: "customer", header: "Customer", sortValue: (c) => c.businessName, render: (c) => <span className="font-medium">{c.businessName}</span> },
              { key: "plan", header: "Plan", render: (c) => c.plan || "—" },
              { key: "terminals", header: "Terminals", align: "right", sortValue: (c) => c.terminals, render: (c) => c.terminals },
              { key: "price", header: "Per terminal", align: "right", sortValue: (c) => c.pricePerTerminal, render: (c) => formatZAR(c.pricePerTerminal) },
              { key: "action", header: "", align: "right", render: (c) => <Button size="sm" variant="secondary" onClick={() => setPriceFor({ customer: c, value: String(c.pricePerTerminal) })}>Change price</Button> },
            ]}
          />
        </section>
      </div>

      {priceFor && (
        <Modal open onClose={() => setPriceFor(null)} title={`Price for ${priceFor.customer.businessName}`} size="sm"
          footer={<><Button variant="secondary" onClick={() => setPriceFor(null)}>Cancel</Button>
            <Button variant="dark" onClick={async () => {
              const n = Number(priceFor.value);
              if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return toast.error("Enter a valid price.");
              try { await setCustomerPrice(actor, priceFor.customer, n, sub(priceFor.customer.id)); toast.success("Price updated."); setPriceFor(null); reload(); } catch (e) { toast.error(errorMessage(e)); }
            }}>Save price</Button></>}>
          <TextField label="ZAR per terminal / month" inputMode="decimal" value={priceFor.value} onChange={(e) => setPriceFor({ ...priceFor, value: e.target.value })} data-autofocus />
        </Modal>
      )}
    </>
  );
}
