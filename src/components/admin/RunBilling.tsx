"use client";

import { Play } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import type { BillingSummary } from "@/lib/billing/server-types";
import { errorMessage } from "@/lib/utils";
import { runBillingNow } from "@/services/teamService";

const ROWS: [keyof BillingSummary, string][] = [
  ["invoicesCreated", "Invoices created"], ["markedOverdue", "Invoices marked overdue"], ["remindersQueued", "Reminders queued"],
  ["statusChanges", "Subscription statuses updated"], ["licencesExtended", "Licences renewed"], ["licenceWarnings", "Expiry warnings queued"],
  ["emailsSent", "Emails sent"], ["emailsFailed", "Emails that failed"],
];

/** Runs the same job as the nightly schedule, on demand. It never bills a cycle twice, so it is safe to press. */
export function RunBilling({ onDone }: { onDone?: () => void }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<BillingSummary | null>(null);
  return (
    <>
      <Button variant="dark" onClick={() => setConfirm(true)}><Play className="h-4 w-4" aria-hidden />Run billing now</Button>
      <ConfirmDialog open={confirm} title="Run the billing job now?" confirmLabel="Run billing" tone="primary"
        description="This does what the nightly job does: creates invoices that are due, flags late ones, updates subscription and licence standing, and queues reminders. It never bills the same cycle twice."
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          try { const r = await runBillingNow(); setConfirm(false); setResult(r.summary); onDone?.(); } catch (e) { toast.error(errorMessage(e)); setConfirm(false); }
        }} />
      <Modal open={Boolean(result)} onClose={() => setResult(null)} title="Billing run finished" description={result ? `For ${result.date}` : undefined} size="sm" footer={<Button variant="dark" onClick={() => setResult(null)}>Done</Button>}>
        {result && (
          <dl className="divide-y divide-line rounded-xl border border-line text-sm">
            {ROWS.map(([k, label]) => <div key={k} className="flex justify-between px-4 py-2.5"><dt className="text-muted">{label}</dt><dd className="font-semibold tabular">{result[k]}</dd></div>)}
          </dl>
        )}
      </Modal>
    </>
  );
}
