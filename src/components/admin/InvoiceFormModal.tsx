"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import type { AppSettings, Customer, Subscription } from "@/types";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useForm } from "@/hooks/useForm";
import { calcTotals } from "@/lib/billing/invoiceRules";
import { MONTHS_PER_CYCLE } from "@/lib/billing/lifecycle";
import { addDays, todayISO } from "@/lib/dates";
import { invoiceSchema } from "@/lib/validation/schemas";
import { errorMessage, formatZAR } from "@/lib/utils";
import { createInvoice } from "@/services/invoiceService";
import { useActor } from "./AuthProvider";

interface LineDraft { description: string; quantity: string; unitPrice: string }

const linesFor = (sub: Subscription | undefined): LineDraft[] =>
  sub
    ? [{
        description: `Malek Enterprise POS licence, ${sub.terminalLimit} terminal${sub.terminalLimit === 1 ? "" : "s"} (${sub.billingFrequency})`,
        quantity: String(sub.terminalLimit),
        unitPrice: String(sub.pricePerTerminal * MONTHS_PER_CYCLE[sub.billingFrequency]),
      }]
    : [{ description: "", quantity: "1", unitPrice: "0" }];

const liveSub = (subs: Subscription[], customerId: string) => subs.find((s) => s.customerId === customerId && s.status !== "CANCELLED");

interface Props {
  customers: Customer[];
  subscriptions: Subscription[];
  settings: AppSettings;
  presetCustomerId?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function InvoiceFormModal({ customers, subscriptions, settings, presetCustomerId, onClose, onSaved }: Props) {
  const actor = useActor();
  const toast = useToast();
  const today = todayISO();
  const initialSub = presetCustomerId ? liveSub(subscriptions, presetCustomerId) : undefined;
  const { values, set, setValues, errors, validate } = useForm(invoiceSchema, {
    customerId: presetCustomerId ?? "", subscriptionId: initialSub?.id ?? null as string | null,
    issueDate: today, dueDate: addDays(today, 7), lines: linesFor(initialSub),
  });
  const [busy, setBusy] = useState(false);

  const pickCustomer = (id: string) => {
    const sub = liveSub(subscriptions, id);
    setValues((v) => ({ ...v, customerId: id, subscriptionId: sub?.id ?? null, lines: linesFor(sub) }));
  };

  const updateLine = (i: number, patch: Partial<LineDraft>) => set("lines", values.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const totals = useMemo(() => calcTotals(
    values.lines.map((l) => ({ description: l.description, quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0 })), settings.billing.vatRate,
  ), [values.lines, settings.billing.vatRate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const data = validate();
    if (!data) return;
    setBusy(true);
    try {
      await createInvoice(actor, data, settings);
      toast.success("Invoice created.");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't create the invoice."));
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={busy ? () => undefined : onClose} title="New invoice" size="lg"
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form="invoice-form" variant="dark" loading={busy}>Create invoice</Button></>}>
      <form id="invoice-form" onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Customer" className="sm:col-span-3" placeholder="Choose a customer" value={values.customerId} disabled={Boolean(presetCustomerId)} error={errors.customerId}
            onChange={(e) => pickCustomer(e.target.value)} options={customers.map((c) => ({ value: c.id, label: c.businessName }))}
            hint={values.customerId && !values.subscriptionId ? "This customer has no live subscription, so this will be a stand-alone invoice." : undefined} />
          <TextField label="Issue date" type="date" value={values.issueDate} onChange={(e) => set("issueDate", e.target.value)} error={errors.issueDate} />
          <TextField label="Due date" type="date" value={values.dueDate} onChange={(e) => set("dueDate", e.target.value)} error={errors.dueDate} />
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Line items</legend>
          <div className="space-y-2">
            {values.lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_5rem_7rem_auto] items-center gap-2">
                <input aria-label={`Line ${i + 1} description`} className="field" placeholder="Description" value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} />
                <input aria-label={`Line ${i + 1} quantity`} inputMode="numeric" className="field tabular" value={l.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} />
                <input aria-label={`Line ${i + 1} unit price`} inputMode="decimal" className="field tabular" value={l.unitPrice} onChange={(e) => updateLine(i, { unitPrice: e.target.value })} />
                <button type="button" aria-label={`Remove line ${i + 1}`} disabled={values.lines.length === 1} onClick={() => set("lines", values.lines.filter((_, idx) => idx !== i))} className="rounded-field p-2 text-muted hover:bg-paper hover:text-bad disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          {errors.lines && <p role="alert" className="mt-2 text-xs font-medium text-[#A22B3B]">{errors.lines}</p>}
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => set("lines", [...values.lines, { description: "", quantity: "1", unitPrice: "0" }])}><Plus className="h-4 w-4" aria-hidden />Add line</Button>
        </fieldset>

        <dl className="ml-auto max-w-xs space-y-1 text-sm tabular">
          <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatZAR(totals.subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">VAT ({Math.round(settings.billing.vatRate * 100)}%)</dt><dd>{formatZAR(totals.vatAmount)}</dd></div>
          <div className="flex justify-between border-t border-line pt-1 text-base font-semibold"><dt>Total</dt><dd>{formatZAR(totals.total)}</dd></div>
        </dl>
      </form>
    </Modal>
  );
}
