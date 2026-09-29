"use client";

import { KeyRound } from "lucide-react";
import { useMemo, useState } from "react";
import type { Customer, License, Subscription, Terminal } from "@/types";
import { CopyButton } from "@/components/marketing/CopyButton";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { SelectField, TextField } from "@/components/ui/Field";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { todayISO } from "@/lib/dates";
import { errorMessage, formatDate, formatDateTime } from "@/lib/utils";
import { activeTerminalCount, effectiveState, runLicenseCommand } from "@/services/licenseService";
import { RowMenu } from "./RowMenu";

interface Props {
  licenses: License[];
  customers: Customer[];
  subscriptions: Subscription[];
  terminals: Terminal[];
  onChanged: () => void;
  fixedCustomerId?: string;
}

/** Shows a freshly generated key exactly once. */
function TokenModal({ token, onClose }: { token: string; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Copy this licence key now" description="For security we only store a hash. This is the only time the full key is shown." size="sm"
      footer={<Button variant="dark" onClick={onClose}>I&apos;ve saved it</Button>}>
      <p className="break-all rounded-field bg-ink-900 p-4 text-center font-receipt text-[15px] font-semibold tracking-wide text-accent" data-autofocus tabIndex={0}>{token}</p>
      <div className="mt-3 flex justify-end"><CopyButton value={token} label="Copy key" /></div>
    </Modal>
  );
}

export function LicenseManager({ licenses, customers, subscriptions, terminals, onChanged, fixedCustomerId }: Props) {
  const toast = useToast();
  const [generating, setGenerating] = useState(false);
  const [genCustomer, setGenCustomer] = useState(fixedCustomerId ?? "");
  const [genExpiry, setGenExpiry] = useState("");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "regenerate" | "revoke" | "reactivate"; license: License } | null>(null);
  const [extend, setExtend] = useState<{ license: License; date: string } | null>(null);

  const subById = useMemo(() => new Map(subscriptions.map((s) => [s.id, s])), [subscriptions]);
  const name = (id: string) => customers.find((c) => c.id === id)?.businessName ?? "Unknown customer";

  const eligible = customers.filter((c) => {
    const sub = subscriptions.find((s) => s.customerId === c.id && s.status !== "CANCELLED");
    // A customer with NO subscription yet is eligible too now - Generate below creates a starter one for them automatically.
    return !sub || !licenses.some((l) => l.subscriptionId === sub.id && !l.revoked && l.status !== "REVOKED");
  });

  const run = async (fn: () => Promise<{ token?: string }>, success: string) => {
    try {
      const res = await fn();
      toast.success(success);
      if (res.token) setToken(res.token);
      onChanged();
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    }
  };

  const generate = async () => {
    const sub = subscriptions.find((s) => s.customerId === genCustomer && s.status !== "CANCELLED");
    // No subscription yet is fine now - the server creates a starter one (no auto-renewal) from the customer's own record.
    setBusy(true);
    const ok = await run(() => runLicenseCommand({ action: "generate", customerId: genCustomer, ...(sub ? { subscriptionId: sub.id } : {}), ...(genExpiry ? { expiryDate: genExpiry } : {}) }), "Licence generated.");
    setBusy(false);
    if (ok) { setGenerating(false); setGenExpiry(""); }
  };

  const confirmCopy = {
    regenerate: { title: "Regenerate licence key", tone: "danger" as const, label: "Regenerate", text: "A new key is issued and the old key stops working immediately. Terminals must be activated with the new key." },
    revoke: { title: "Revoke licence", tone: "danger" as const, label: "Revoke licence", text: "The customer's tills will be blocked the next time they check in. You can reactivate the licence later." },
    reactivate: { title: "Reactivate licence", tone: "primary" as const, label: "Reactivate", text: "The existing key works again, subject to the subscription being in good standing." },
  };

  return (
    <>
      <DataTable
        caption="Licences" csv={{ filename: "licences", columns: [{ header: "Customer", value: (l) => name(l.customerId) }, { header: "Key prefix", value: (l) => l.tokenPrefix }, { header: "State", value: (l) => effectiveState(l, subById.get(l.subscriptionId ?? "")) }, { header: "Issued", value: (l) => l.issueDate }, { header: "Expires", value: (l) => l.expiryDate }, { header: "Last check-in", value: (l) => l.lastVerifiedAt }] }} rows={licenses} rowKey={(l) => l.id} searchPlaceholder="Search licences"
        searchText={(l) => `${name(l.customerId)} ${l.tokenPrefix}`}
        filters={[{ key: "state", label: "State", options: ["ACTIVE", "GRACE", "SUSPENDED", "EXPIRED", "REVOKED"].map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() })),
          predicate: (l, v) => effectiveState(l, subById.get(l.subscriptionId ?? "")) === v }]}
        toolbar={<Button variant="dark" size="sm" onClick={() => { setGenCustomer(fixedCustomerId ?? ""); setGenerating(true); }}><KeyRound className="h-4 w-4" aria-hidden />Generate licence</Button>}
        empty={<EmptyState icon={KeyRound} title="No licences yet" description="Generate a licence for a customer who has a subscription. The key is shown once." />}
        columns={[
          ...(fixedCustomerId ? [] : [{ key: "customer", header: "Customer", sortValue: (l: License) => name(l.customerId), render: (l: License) => <span className="font-medium">{name(l.customerId)}</span> }]),
          { key: "key", header: "Key", render: (l) => <code className="font-receipt text-xs">{l.tokenPrefix}-••••-••••</code> },
          { key: "state", header: "State", render: (l) => <StatusBadge status={effectiveState(l, subById.get(l.subscriptionId ?? ""))} /> },
          { key: "terminals", header: "Terminals", align: "right", render: (l) => <span className="tabular">{activeTerminalCount(l.id, terminals)} / {subById.get(l.subscriptionId ?? "")?.terminalLimit ?? l.terminalLimit}</span> },
          { key: "issued", header: "Issued", sortValue: (l) => l.issueDate, render: (l) => formatDate(l.issueDate) },
          { key: "expires", header: "Expires", sortValue: (l) => l.expiryDate, render: (l) => formatDate(l.expiryDate) },
          { key: "verified", header: "Last check-in", sortValue: (l) => l.lastVerifiedAt ?? "", render: (l) => <span className="text-muted">{formatDateTime(l.lastVerifiedAt)}</span> },
          { key: "actions", header: "", align: "right", render: (l) => (
            <RowMenu label={`Actions for ${l.tokenPrefix}`} items={[
              { label: "Extend expiry", onSelect: () => setExtend({ license: l, date: l.expiryDate }), hidden: l.revoked },
              { label: "Regenerate key", onSelect: () => setConfirm({ kind: "regenerate", license: l }), hidden: l.revoked },
              { label: "Revoke", danger: true, onSelect: () => setConfirm({ kind: "revoke", license: l }), hidden: l.revoked },
              { label: "Reactivate", onSelect: () => setConfirm({ kind: "reactivate", license: l }), hidden: !l.revoked },
            ]} />
          ) },
        ]}
      />

      {generating && (
        <Modal open onClose={busy ? () => undefined : () => setGenerating(false)} title="Generate licence" size="sm"
          footer={<><Button variant="secondary" onClick={() => setGenerating(false)} disabled={busy}>Cancel</Button><Button variant="dark" onClick={generate} loading={busy} disabled={!genCustomer}>Generate</Button></>}>
          <div className="space-y-4">
            <SelectField label="Customer" placeholder="Choose a customer" value={genCustomer} disabled={Boolean(fixedCustomerId)} onChange={(e) => setGenCustomer(e.target.value)}
              options={(fixedCustomerId ? customers.filter((c) => c.id === fixedCustomerId) : eligible).map((c) => ({ value: c.id, label: c.businessName }))}
              hint={eligible.length === 0 ? "Everyone already has an active licence." : "Customers with an active licence already are hidden. If someone has no subscription yet, one is created for them automatically."} />
            <TextField label="Expiry date (optional)" type="date" min={todayISO()} value={genExpiry} onChange={(e) => setGenExpiry(e.target.value)} hint="Leave blank to use the default validity from Settings." />
          </div>
        </Modal>
      )}

      {token && <TokenModal token={token} onClose={() => setToken(null)} />}

      <ConfirmDialog
        open={Boolean(confirm)} title={confirm ? confirmCopy[confirm.kind].title : ""} tone={confirm ? confirmCopy[confirm.kind].tone : "primary"}
        confirmLabel={confirm ? confirmCopy[confirm.kind].label : ""} description={confirm ? confirmCopy[confirm.kind].text : ""}
        details={confirm ? [{ label: "Customer", value: name(confirm.license.customerId) }, { label: "Key", value: confirm.license.tokenPrefix }] : []}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          if (!confirm) return;
          const ok = await run(() => runLicenseCommand({ action: confirm.kind, licenseId: confirm.license.id }), `Licence ${confirm.kind === "regenerate" ? "regenerated" : confirm.kind === "revoke" ? "revoked" : "reactivated"}.`);
          if (ok) setConfirm(null);
        }}
      />

      {extend && (
        <Modal open onClose={() => setExtend(null)} title="Extend expiry" size="sm"
          footer={<><Button variant="secondary" onClick={() => setExtend(null)}>Cancel</Button>
            <Button variant="dark" onClick={async () => { const ok = await run(() => runLicenseCommand({ action: "extend", licenseId: extend.license.id, expiryDate: extend.date }), "Expiry updated."); if (ok) setExtend(null); }}>Save</Button></>}>
          <TextField label="New expiry date" type="date" value={extend.date} onChange={(e) => setExtend({ ...extend, date: e.target.value })} data-autofocus />
        </Modal>
      )}
    </>
  );
}
