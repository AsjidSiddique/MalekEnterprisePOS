"use client";

import { addDoc, serverTimestamp } from "firebase/firestore";
import { CheckCircle2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { useForm } from "@/hooks/useForm";
import { inquirySchema } from "@/lib/validation/schemas";
import { withTimeout } from "@/lib/async";
import { explainError } from "@/lib/firebase/explain";
import { isDemoMode } from "@/lib/demo/flag";
import { col } from "@/services/base";

/** A rejection the visitor can fix (bad input / too many attempts) - never retried through the fallback. */
class ContactRejected extends Error {}

type ContactPayload = { name: string; email: string; phone: string; business: string; message: string };

/**
 * Preferred path: our own server route (works even when the visitor's network blocks Firestore's browser
 * connection). If that route isn't available (server credentials not configured, or a network error), fall
 * back to writing directly - but with a timeout, because an unreachable Firestore never rejects a write, it
 * just hangs, which used to leave the button spinning forever.
 */
async function sendInquiry(data: ContactPayload): Promise<void> {
  if (!isDemoMode) {
    try {
      const res = await withTimeout(fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }), 15_000, "Sending your message");
      if (res.ok) return;
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 400 || res.status === 429) throw new ContactRejected(body.error ?? "Please check the form and try again.");
      console.warn(`[ContactForm] server route unavailable (HTTP ${res.status}: ${body.error ?? "no detail"}) - trying a direct write instead.`);
    } catch (err) {
      if (err instanceof ContactRejected) throw err;
      console.warn("[ContactForm] server route failed - trying a direct write instead:", err);
    }
  }
  await withTimeout(addDoc(col("inquiries"), { ...data, createdAt: serverTimestamp() }), 15_000, "Sending your message");
}

export function ContactForm() {
  const { values, set, errors, validate } = useForm(inquirySchema, { name: "", email: "", phone: "", business: "", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFailure("");
    const data = validate();
    if (!data) return;
    // Hidden honeypot: real visitors never fill it in. Pretend success for bots.
    if (values.website) return setDone(true);
    setBusy(true);
    try {
      await sendInquiry(data);
      setDone(true);
    } catch (err) {
      // Same reasoning as useAsyncData: print the real error before showing the friendly one, so a
      // failed submission is diagnosable from the Console tab instantly instead of needing this exact
      // conversation each time.
      console.error("[ContactForm] submit failed:", err);
      const why = explainError(err);
      console.error(`[ContactForm] diagnosis: ${why.kind} - ${why.hint}`);
      setFailure(
        err instanceof ContactRejected ? err.message
        : why.kind === "not-configured" ? "The contact form isn't connected yet. Please try again later."
        : "We couldn't send your message right now. Please try again in a few minutes.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="panel rounded-xl3 p-10 text-center" role="status">
        <CheckCircle2 className="mx-auto h-10 w-10 text-ok" aria-hidden />
        <h2 className="mt-3 text-xl font-semibold">Message sent</h2>
        <p className="mt-1 text-muted">Thanks. We&apos;ll reply to {values.email || "you"} shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="panel space-y-5 rounded-xl3 p-7 sm:p-9">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Your name" value={values.name} onChange={(e) => set("name", e.target.value)} error={errors.name} autoComplete="name" />
        <TextField label="Email" type="email" value={values.email} onChange={(e) => set("email", e.target.value)} error={errors.email} autoComplete="email" />
        <TextField label="Phone (optional)" type="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} error={errors.phone} autoComplete="tel" />
        <TextField label="Business (optional)" value={values.business} onChange={(e) => set("business", e.target.value)} error={errors.business} autoComplete="organization" />
      </div>
      <TextAreaField label="How can we help?" rows={5} value={values.message} onChange={(e) => set("message", e.target.value)} error={errors.message} />
      <div className="absolute left-[-9999px] h-0 w-0 overflow-hidden" aria-hidden>
        <label>Website<input tabIndex={-1} autoComplete="off" value={values.website} onChange={(e) => set("website", e.target.value)} /></label>
      </div>
      {failure && <p role="alert" className="rounded-field bg-bad/10 px-3 py-2 text-sm text-[#A22B3B]">{failure}</p>}
      <Button type="submit" variant="dark" size="lg" loading={busy}>Send message</Button>
    </form>
  );
}
