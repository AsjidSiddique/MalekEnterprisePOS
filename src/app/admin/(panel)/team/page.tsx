"use client";

import { ShieldCheck, UserPlus, Users } from "lucide-react";
import { useState, type FormEvent } from "react";
import { CopyButton } from "@/components/marketing/CopyButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useAsyncData } from "@/hooks/useAsyncData";
import { errorMessage, timeAgo } from "@/lib/utils";
import { inviteAdmin, listAdmins, revokeAdmin, type TeamMember } from "@/services/teamService";

export default function TeamPage() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsyncData(listAdmins, []);
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<{ email: string; url: string; created: boolean } | null>(null);
  const [removing, setRemoving] = useState<TeamMember | null>(null);

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await inviteAdmin(email.trim());
      setLink({ email: email.trim(), url: r.resetLink, created: r.created });
      setInviting(false); setEmail(""); reload();
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };

  const add = <Button variant="dark" onClick={() => setInviting(true)}><UserPlus className="h-4 w-4" aria-hidden />Add an admin</Button>;

  return (
    <>
      <PageHeader title="Team" description="The people who can sign in to this admin panel." actions={add} />
      <div className="mb-6 flex gap-3 rounded-2xl bg-ink-900 p-5 text-sm text-ink-200">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
        <p><b className="text-white">Every admin can see and change everything</b>, including customers, billing and licences. Only add people you trust. Removed admins are signed out everywhere straight away, and every change is recorded in the audit log.</p>
      </div>

      {error ? <ErrorState title="Couldn't load the team" error={error} onRetry={reload} /> : loading && !data ? <Skeleton className="h-48" /> : data && data.length === 0 ? (
        <div className="panel rounded-xl3"><EmptyState icon={Users} title="No admins found" description="Run npm run admin:grant to create the first one." /></div>
      ) : data && (
        <ul className="grid gap-4 md:grid-cols-2">
          {data.map((m) => (
            <li key={m.uid} className="flex items-center gap-4 rounded-xl2 border border-line bg-surface p-5 shadow-card">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-ink-700 to-ink-900 font-display text-lg font-bold text-white">{(m.email[0] ?? "?").toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate font-semibold">{m.name || m.email.split("@")[0]}{m.isYou && <Badge tone="accent">You</Badge>}</p>
                <p className="truncate text-sm text-muted">{m.email}</p>
                <p className="mt-0.5 text-xs text-muted">Last signed in {timeAgo(m.lastSignIn)}</p>
              </div>
              {!m.isYou && <Button size="sm" variant="ghost" className="text-[#A22B3B]" onClick={() => setRemoving(m)}>Remove</Button>}
            </li>
          ))}
        </ul>
      )}

      {inviting && (
        <Modal open onClose={busy ? () => undefined : () => setInviting(false)} title="Add an admin" description="They'll set their own password. You never see or choose it." size="sm"
          footer={<><Button variant="secondary" onClick={() => setInviting(false)} disabled={busy}>Cancel</Button><Button type="submit" form="invite-form" variant="dark" loading={busy} disabled={!email.includes("@")}>Add admin</Button></>}>
          <form id="invite-form" onSubmit={invite} noValidate><TextField label="Their email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} data-autofocus hint="If they don't have an account yet, one is created for them." /></form>
        </Modal>
      )}

      <Modal open={Boolean(link)} onClose={() => setLink(null)} title="Send them this link" description={link ? `${link.email} is now an admin.` : undefined} size="sm" footer={<Button variant="dark" onClick={() => setLink(null)}>Done</Button>}>
        {link && (
          <div className="space-y-3">
            <p className="text-sm text-muted">{link.created ? "This one-time link lets them choose a password and sign in." : "They already had an account. This link lets them reset their password if they need to."} It can&apos;t be shown again.</p>
            <p className="break-all rounded-xl bg-ink-900 p-3 font-receipt text-[12px] text-accent">{link.url}</p>
            <div className="flex justify-end"><CopyButton value={link.url} label="Copy link" /></div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={Boolean(removing)} title="Remove this admin?" confirmLabel="Remove admin" description="They lose access straight away and are signed out everywhere. Their account isn't deleted, and you can add them again later."
        details={removing ? [{ label: "Person", value: removing.email }] : []} onClose={() => setRemoving(null)}
        onConfirm={async () => { if (!removing) return; try { await revokeAdmin(removing.uid); toast.success(`${removing.email} removed.`); setRemoving(null); reload(); } catch (err) { toast.error(errorMessage(err)); } }} />
    </>
  );
}
