"use client";

import { useState, type FormEvent } from "react";
import type { AppSettings, Customer, Subscription, SubscriptionStatus } from "@/types";
import { Button } from "@/components/ui/Button";
import { CheckboxField, SelectField, TextField } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useForm } from "@/hooks/useForm";
import { advanceBillingDate } from "@/lib/billing/lifecycle";
import { nextOccurrenceOfDay, todayISO } from "@/lib/dates";
import { subscriptionSchema } from "@/lib/validation/schemas";
import { cycleAmount } from "@/lib/billing/lifecycle";
import { errorMessage, formatZAR } from "@/lib/utils";
import { createSubscription, updateSubscription } from "@/services/subscriptionService";
import { useActor } from "./AuthProvider";

interface Props {
  customers: Customer[];
  settings: AppSettings;
  subscription?: Subscription;
  fixedCustomerId?: string;
  onClose: () => void;
  onSaved: () => void;
}

const STATUSES: SubscriptionStatus[] = ["ACTIVE", "PENDING", "OVERDUE", "GRACE", "SUSPENDED", "CANCELLED"];

export function SubscriptionFormModal({ customers, settings, subscription, fixedCustomerId, onClose, onSaved }: Props) {
  const actor = useActor();
  const toast = useToast();
  const today = todayISO();
  const seed = customers.find((c) => c.id === (subscription?.customerId ?? fixedCustomerId));
  const { values, set, setValues, errors, validate } = useForm(subscriptionSchema, {
    customerId: subscription?.customerId ?? fixedCustomerId ?? "",
    plan: subscription?.plan ?? seed?.plan ?? "",
    terminalLimit: String(subscription?.terminalLimit ?? seed?.terminals ?? 1),
    pricePerTerminal: String(subscription?.pricePerTerminal ?? seed?.pricePerTerminal ?? 0),
    billingFrequency: subscription?.billingFrequency ?? "monthly",
    startDate: subscription?.startDate ?? today,
    nextBillingDate: subscription?.nextBillingDate ?? nextOccurrenceOfDay(today, settings.billing.billingDay),
    status: subscription?.status ?? "PENDING",
    gracePeriodDays: String(subscription?.gracePeriodDays ?? settings.billing.defaultGraceDays),
    autoRenewal: subscription?.autoRenewal ?? true,
  });
  const [busy, setBusy] = useState(false);

  const pickCustomer = (id: string) => {
    const c = customers.find((x) => x.id === id);
    setValues((v) => ({ ...v, customerId: id, ...(c ? { plan: c.plan, terminalLimit: String(c.terminals), pricePerTerminal: String(c.pricePerTerminal) } : {}) }));
  };

  const preview = cycleAmount(Number(values.terminalLimit) || 0, Number(values.pricePerTerminal) || 0, values.billingFrequency);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const data = validate();
    if (!data) return;
    setBusy(true);
    try {
      if (subscription) await updateSubscription(actor, subscription.id, data);
      else await createSubscription(actor, data);
      toast.success(subscription ? "Subscription updated." : "Subscription created.");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save the subscription."));
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={busy ? () => undefined : onClose} title={subscription ? "Edit subscription" : "New subscription"} size="lg"
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form="sub-form" variant="dark" loading={busy}>{subscription ? "Save changes" : "Create subscription"}</Button></>}>
      <form id="sub-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Customer" className="sm:col-span-2" placeholder="Choose a customer" value={values.customerId} disabled={Boolean(subscription || fixedCustomerId)} error={errors.customerId}
          onChange={(e) => pickCustomer(e.target.value)} options={customers.map((c) => ({ value: c.id, label: c.businessName }))} />
        <TextField label="Plan" value={values.plan} onChange={(e) => set("plan", e.target.value)} error={errors.plan} />
        <SelectField label="Status" value={values.status} onChange={(e) => set("status", e.target.value as SubscriptionStatus)} options={STATUSES.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))}
          hint="Status updates itself from invoices; change it here only to override." />
        <TextField label="Terminal limit" inputMode="numeric" value={values.terminalLimit} onChange={(e) => set("terminalLimit", e.target.value)} error={errors.terminalLimit} />
        <TextField label="Price per terminal (ZAR / month)" inputMode="decimal" value={values.pricePerTerminal} onChange={(e) => set("pricePerTerminal", e.target.value)} error={errors.pricePerTerminal} />
        <SelectField label="Billing frequency" value={values.billingFrequency} onChange={(e) => {
          const f = e.target.value as "monthly" | "quarterly" | "annual";
          setValues((v) => ({ ...v, billingFrequency: f }));
        }} options={[{ value: "monthly", label: "Monthly" }, { value: "quarterly", label: "Quarterly" }, { value: "annual", label: "Annual" }]} />
        <TextField label="Grace period (days)" inputMode="numeric" value={values.gracePeriodDays} onChange={(e) => set("gracePeriodDays", e.target.value)} error={errors.gracePeriodDays} hint="Days after the due date before the licence is suspended." />
        <TextField label="Start date" type="date" value={values.startDate} onChange={(e) => set("startDate", e.target.value)} error={errors.startDate} />
        <TextField label="Next billing date" type="date" value={values.nextBillingDate} onChange={(e) => set("nextBillingDate", e.target.value)} error={errors.nextBillingDate}
          hint={values.nextBillingDate ? `Following cycle: ${advanceBillingDate(values.nextBillingDate, values.billingFrequency)}` : undefined} />
        <CheckboxField className="sm:col-span-2" label="Automatic renewal" description="Invoices are created automatically on each billing date." checked={values.autoRenewal} onChange={(e) => set("autoRenewal", e.target.checked)} />
        <p className="rounded-field bg-paper px-3 py-2 text-sm sm:col-span-2">Each {values.billingFrequency === "monthly" ? "month" : values.billingFrequency === "quarterly" ? "quarter" : "year"}, this customer is billed <strong className="tabular">{formatZAR(preview)}</strong> before VAT.</p>
      </form>
    </Modal>
  );
}
