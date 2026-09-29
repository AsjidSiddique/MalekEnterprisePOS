"use client";

import { useState, type FormEvent } from "react";
import type { Invoice, PaymentMethod } from "@/types";
import { Button } from "@/components/ui/Button";
import { CheckboxField, SelectField, TextAreaField } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useForm } from "@/hooks/useForm";
import { markPaidSchema } from "@/lib/validation/schemas";
import { errorMessage, formatDate, formatZAR } from "@/lib/utils";
import { markInvoicePaid } from "@/services/invoiceService";
import { useActor } from "./AuthProvider";

export const METHOD_LABEL: Record<PaymentMethod, string> = { cash: "Cash", bank_transfer: "Bank transfer (EFT)", online: "Online", manual: "Manual", other: "Other" };

export function MarkPaidModal({ invoice, customerName, onClose, onDone }: { invoice: Invoice; customerName: string; onClose: () => void; onDone: () => void }) {
  const actor = useActor();
  const toast = useToast();
  const { values, set, errors, validate } = useForm(markPaidSchema, { method: "bank_transfer" as PaymentMethod, note: "" });
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const wasCancelled = invoice.status === "CANCELLED";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const data = validate();
    if (!data) return;
    if (wasCancelled && !confirmed) return toast.error("Tick the box to confirm you want to pay a cancelled invoice.");
    setBusy(true);
    try {
      await markInvoicePaid(actor, invoice, data, { confirmed });
      toast.success(`${invoice.number} marked as paid.`);
      onDone();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't mark the invoice as paid."));
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={busy ? () => undefined : onClose} title="Mark invoice as paid" description="Records a payment against this invoice and updates the subscription." size="sm"
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form="paid-form" variant="primary" loading={busy}>Mark as paid</Button></>}>
      <form id="paid-form" onSubmit={submit} noValidate className="space-y-4">
        <dl className="divide-y divide-line rounded-field border border-line text-sm">
          {[["Invoice", invoice.number], ["Customer", customerName], ["Due", formatDate(invoice.dueDate)], ["Amount", formatZAR(invoice.total)]].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 px-3 py-2"><dt className="text-muted">{k}</dt><dd className="font-medium tabular">{v}</dd></div>
          ))}
        </dl>
        <SelectField label="Payment method" value={values.method} onChange={(e) => set("method", e.target.value as PaymentMethod)} error={errors.method}
          options={(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((m) => ({ value: m, label: METHOD_LABEL[m] }))} />
        <TextAreaField label="Note (optional)" rows={2} value={values.note} onChange={(e) => set("note", e.target.value)} error={errors.note} placeholder="e.g. EFT reference or who received the cash" />
        {wasCancelled && <CheckboxField label="This invoice was cancelled. Pay it anyway." description="The payment and this override are written to the audit log." checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />}
      </form>
    </Modal>
  );
}
