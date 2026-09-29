"use client";

import { useState, type FormEvent } from "react";
import type { Customer, PricingConfig } from "@/types";
import { Button } from "@/components/ui/Button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useForm } from "@/hooks/useForm";
import { customerSchema } from "@/lib/validation/schemas";
import { errorMessage } from "@/lib/utils";
import { createCustomer, updateCustomer } from "@/services/customerService";
import { useActor } from "./AuthProvider";

interface Props {
  customer?: Customer;
  pricing: PricingConfig | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}

/** Mount this only while it should be open — it starts with fresh state each time. */
export function CustomerFormModal({ customer, pricing, onClose, onSaved }: Props) {
  const actor = useActor();
  const toast = useToast();
  const defaultPlan = pricing?.plans.find((p) => p.highlighted) ?? pricing?.plans[0];
  const { values, set, errors, validate } = useForm(customerSchema, {
    name: customer?.name ?? "", businessName: customer?.businessName ?? "", email: customer?.email ?? "", phone: customer?.phone ?? "",
    address: customer?.address ?? "", country: customer?.country ?? "South Africa",
    terminals: String(customer?.terminals ?? defaultPlan?.minTerminals ?? 1),
    pricePerTerminal: String(customer?.pricePerTerminal ?? defaultPlan?.pricePerTerminal ?? 0),
    plan: customer?.plan ?? defaultPlan?.name ?? "", status: customer?.status ?? "active", notes: customer?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const data = validate();
    if (!data) return;
    setBusy(true);
    try {
      if (customer) {
        await updateCustomer(actor, customer.id, data);
        toast.success("Customer updated.");
        onSaved(customer.id);
      } else {
        const id = await createCustomer(actor, data);
        toast.success("Customer created.");
        onSaved(id);
      }
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save the customer."));
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={busy ? () => undefined : onClose} title={customer ? "Edit customer" : "Add customer"} size="lg"
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form="customer-form" variant="dark" loading={busy}>{customer ? "Save changes" : "Create customer"}</Button></>}>
      <form id="customer-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <TextField label="Contact name" value={values.name} onChange={(e) => set("name", e.target.value)} error={errors.name} autoComplete="off" />
        <TextField label="Business name" value={values.businessName} onChange={(e) => set("businessName", e.target.value)} error={errors.businessName} />
        <TextField label="Email" type="email" value={values.email} onChange={(e) => set("email", e.target.value)} error={errors.email} />
        <TextField label="Phone" type="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} error={errors.phone} />
        <TextField label="Address" className="sm:col-span-2" value={values.address} onChange={(e) => set("address", e.target.value)} error={errors.address} />
        <TextField label="Country" value={values.country} onChange={(e) => set("country", e.target.value)} error={errors.country} />
        <SelectField label="Status" value={values.status} onChange={(e) => set("status", e.target.value as "active" | "inactive")} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
        <TextField label="Number of terminals" inputMode="numeric" value={values.terminals} onChange={(e) => set("terminals", e.target.value)} error={errors.terminals} />
        <TextField label="Price per terminal (ZAR / month)" inputMode="decimal" value={values.pricePerTerminal} onChange={(e) => set("pricePerTerminal", e.target.value)} error={errors.pricePerTerminal} hint="This customer's own price. It doesn't change the public pricing." />
        <div className="sm:col-span-2">
          <TextField label="Plan" list="plan-names" value={values.plan} onChange={(e) => set("plan", e.target.value)} error={errors.plan} />
          <datalist id="plan-names">{pricing?.plans.map((p) => <option key={p.id} value={p.name} />)}</datalist>
        </div>
        <TextAreaField label="Internal notes" className="sm:col-span-2" value={values.notes} onChange={(e) => set("notes", e.target.value)} error={errors.notes} hint="Only visible to admins." />
      </form>
    </Modal>
  );
}
