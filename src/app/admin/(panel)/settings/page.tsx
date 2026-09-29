"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useActor } from "@/components/admin/AuthProvider";
import { Button } from "@/components/ui/Button";
import { CheckboxField, TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useAsyncData } from "@/hooks/useAsyncData";
import { settingsSchema } from "@/lib/validation/schemas";
import { errorMessage } from "@/lib/utils";
import { getSettings, saveSettings } from "@/services/settingsService";
import type { AppSettings } from "@/types";

/** Numbers are edited as text and converted by the schema on save. */
type Draft = { [S in keyof AppSettings]: { [K in keyof AppSettings[S]]: AppSettings[S][K] extends boolean ? boolean : string } };

const toDraft = (s: AppSettings): Draft => ({
  general: { ...s.general },
  branding: { ...s.branding },
  billing: { vatRate: String(Math.round(s.billing.vatRate * 10000) / 100), invoicePrefix: s.billing.invoicePrefix, billingDay: String(s.billing.billingDay), defaultGraceDays: String(s.billing.defaultGraceDays), reminderDaysBefore: String(s.billing.reminderDaysBefore) },
  licensing: { defaultValidityDays: String(s.licensing.defaultValidityDays), offlineGraceDays: String(s.licensing.offlineGraceDays), verificationIntervalHours: String(s.licensing.verificationIntervalHours) },
  notifications: { ...s.notifications },
  releases: { ...s.releases },
});

const Section = ({ title, description, children }: { title: string; description: string; children: ReactNode }) => (
  <section className="panel grid gap-6 p-5 lg:grid-cols-[1fr_2fr]">
    <div><h2 className="text-base font-semibold">{title}</h2><p className="mt-1 text-sm text-muted">{description}</p></div>
    <div className="grid gap-4 sm:grid-cols-2">{children}</div>
  </section>
);

export default function SettingsPage() {
  const actor = useActor();
  const toast = useToast();
  const { data, loading, error, reload } = useAsyncData(getSettings, []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  useEffect(() => { if (data) setDraft(toDraft(data)); }, [data]);

  if (error) return <><PageHeader title="Settings" /><ErrorState title="Couldn't load settings" error={error} onRetry={reload} /></>;
  if (loading && !draft) return <><PageHeader title="Settings" /><Skeleton className="h-96" /></>;
  if (!draft) return null;

  const up = <S extends keyof Draft, K extends keyof Draft[S]>(section: S, key: K, value: Draft[S][K]) =>
    setDraft((d) => (d ? { ...d, [section]: { ...d[section], [key]: value } } : d));
  const text = <S extends keyof Draft, K extends keyof Draft[S]>(section: S, key: K, label: string, extra?: { hint?: string; type?: string }) => (
    <TextField label={label} hint={extra?.hint} type={extra?.type} value={String(draft[section][key])} onChange={(e) => up(section, key, e.target.value as Draft[S][K])} />
  );

  const save = async () => {
    const parsed = settingsSchema.safeParse({ ...draft, billing: { ...draft.billing, vatRate: Number(draft.billing.vatRate) / 100 } });
    if (!parsed.success) {
      setProblems(parsed.error.issues.map((i) => `${i.path.join(" › ")}: ${i.message}`));
      return toast.error("Some settings need attention.");
    }
    setProblems([]);
    setSaving(true);
    try { await saveSettings(actor, parsed.data); toast.success("Settings saved."); reload(); } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title="Settings" description="Defaults used across billing, licensing and the public site." actions={<Button variant="dark" onClick={save} loading={saving}>Save settings</Button>} />
      {problems.length > 0 && <ul role="alert" className="mb-4 list-disc space-y-1 rounded-panel border border-bad/30 bg-bad/5 py-3 pl-8 pr-4 text-sm text-[#A22B3B]">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
      <div className="space-y-5">
        <Section title="General" description="Shown on invoices and, for the email addresses, on the public contact page.">
          {text("general", "productName", "Product name")}
          {text("general", "supportEmail", "Support email", { type: "email" })}
          {text("general", "salesEmail", "Sales email", { type: "email" })}
        </Section>
        <Section title="Billing" description="Rules for invoices, VAT and how long a customer can be late before their licence is suspended.">
          {text("billing", "vatRate", "VAT rate (%)", { hint: "South African VAT is currently 15%. Set 0 to charge no VAT." })}
          {text("billing", "invoicePrefix", "Invoice prefix", { hint: "Invoices are numbered like INV-202609-0001." })}
          {text("billing", "billingDay", "Billing day of month", { hint: "1 to 28. Used as the default for new subscriptions." })}
          {text("billing", "defaultGraceDays", "Default grace period (days)")}
          {text("billing", "reminderDaysBefore", "Send reminder (days before due)")}
        </Section>
        <Section title="Licensing" description="How long a licence lasts and how tolerant tills are of being offline.">
          {text("licensing", "defaultValidityDays", "Default licence validity (days)")}
          {text("licensing", "offlineGraceDays", "Offline allowance (days)", { hint: "How long a till may trade without reaching the licence server." })}
          {text("licensing", "verificationIntervalHours", "Check-in interval (hours)")}
        </Section>
        <Section title="Notifications" description="Automatic messages sent by the daily billing job.">
          <CheckboxField label="Send payment reminders" description="Queues a reminder before each due date and when an invoice goes overdue." checked={draft.notifications.sendReminders} onChange={(e) => up("notifications", "sendReminders", e.target.checked)} />
          <CheckboxField label="Deliver reminders by email" description="Needs an email provider. See Notifications → Delivery setup." checked={draft.notifications.emailEnabled} onChange={(e) => up("notifications", "emailEnabled", e.target.checked)} />
        </Section>
        <Section title="Releases" description="Rules applied when publishing a release.">
          <CheckboxField label="Require a SHA-256 checksum to publish" checked={draft.releases.requireChecksum} onChange={(e) => up("releases", "requireChecksum", e.target.checked)} />
        </Section>
        <Section title="Branding" description="Placeholder wordmark text. Replace the logo component and CSS colour tokens to fully re-brand.">
          {text("branding", "logoText", "Logo text")}
          {text("branding", "accentHex", "Accent colour", { hint: "Hex, e.g. #F2B84B. Saved for reference; change --accent in globals.css to apply it." })}
        </Section>
      </div>
    </>
  );
}
