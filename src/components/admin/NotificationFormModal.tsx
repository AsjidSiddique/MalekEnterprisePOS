"use client";

import { useState, type FormEvent } from "react";
import type { Customer, NotificationChannel, NotificationType } from "@/types";
import { Button } from "@/components/ui/Button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useForm } from "@/hooks/useForm";
import { notificationSchema } from "@/lib/validation/schemas";
import { errorMessage } from "@/lib/utils";
import { queueNotification } from "@/services/notificationService";
import { useActor } from "./AuthProvider";

const TYPES: { value: NotificationType; label: string }[] = [
  { value: "general", label: "General message" }, { value: "payment_reminder", label: "Payment reminder" }, { value: "payment_failed", label: "Payment failed" },
  { value: "invoice_issued", label: "Invoice issued" }, { value: "license_expiry", label: "Licence expiry" }, { value: "subscription_status", label: "Subscription status" },
  { value: "release_announcement", label: "Release announcement" },
];

export function NotificationFormModal({ customers, onClose, onSaved }: { customers: Customer[]; onClose: () => void; onSaved: () => void }) {
  const actor = useActor();
  const toast = useToast();
  const { values, set, setValues, errors, validate } = useForm(notificationSchema, {
    type: "general" as NotificationType, channel: "email" as NotificationChannel, customerId: "" as string, recipient: "", title: "", message: "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const data = validate();
    if (!data) return;
    setBusy(true);
    try {
      await queueNotification(actor, { ...data, customerId: data.customerId || null });
      toast.success("Notification queued.");
      onSaved();
      onClose();
    } catch (err) { toast.error(errorMessage(err)); setBusy(false); }
  };

  return (
    <Modal open onClose={busy ? () => undefined : onClose} title="New notification" size="md"
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form="notif-form" variant="dark" loading={busy}>Queue notification</Button></>}>
      <form id="notif-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Type" value={values.type} onChange={(e) => set("type", e.target.value as NotificationType)} options={TYPES} />
        <SelectField label="Channel" value={values.channel} onChange={(e) => set("channel", e.target.value as NotificationChannel)}
          options={[{ value: "email", label: "Email" }, { value: "in_app", label: "In-app" }, { value: "whatsapp", label: "WhatsApp (not connected)" }]} />
        <SelectField label="Customer (optional)" placeholder="No specific customer" value={values.customerId ?? ""} onChange={(e) => {
          const c = customers.find((x) => x.id === e.target.value);
          setValues((v) => ({ ...v, customerId: e.target.value, recipient: c?.email ?? v.recipient }));
        }} options={customers.map((c) => ({ value: c.id, label: c.businessName }))} />
        <TextField label="Recipient email" type="email" value={values.recipient} onChange={(e) => set("recipient", e.target.value)} error={errors.recipient} />
        <TextField label="Title" className="sm:col-span-2" value={values.title} onChange={(e) => set("title", e.target.value)} error={errors.title} />
        <TextAreaField label="Message" rows={5} className="sm:col-span-2" value={values.message} onChange={(e) => set("message", e.target.value)} error={errors.message} />
      </form>
    </Modal>
  );
}
