"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export const GO_SHORTCUTS: [key: string, href: string, label: string][] = [
  ["d", "/admin", "Dashboard"], ["c", "/admin/customers", "Customers"], ["s", "/admin/subscriptions", "Subscriptions"], ["i", "/admin/invoices", "Invoices"],
  ["p", "/admin/payments", "Payments"], ["a", "/admin/reports", "Reports"], ["x", "/admin/access", "Access control"], ["l", "/admin/licenses", "Licences"], ["t", "/admin/terminals", "Terminals"],
  ["r", "/admin/releases", "Releases"], ["n", "/admin/notifications", "Notifications"], ["m", "/admin/team", "Team"], ["u", "/admin/audit-logs", "Audit logs"],
];

const Key = ({ children }: { children: string }) => <kbd className="inline-grid h-7 min-w-7 place-items-center align-middle rounded-lg border border-line bg-paper px-2 font-sans text-xs font-semibold text-ink-800 shadow-[0_1px_0_rgb(12_26_61/0.08)]">{children}</kbd>;

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" description="Work faster without leaving the keyboard." size="md" footer={<Button variant="dark" onClick={onClose}>Got it</Button>}>
      <div className="space-y-6">
        <section>
          <h3 className="mb-2 text-sm font-semibold">Anywhere</h3>
          <ul className="divide-y divide-line rounded-xl border border-line text-sm">
            <li className="flex items-center justify-between px-4 py-2.5"><span>Search everything</span><span className="flex gap-1"><Key>Ctrl</Key><Key>K</Key></span></li>
            <li className="flex items-center justify-between px-4 py-2.5"><span>Show this list</span><Key>?</Key></li>
          </ul>
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold">Go to a page: press <Key>G</Key> then…</h3>
          <ul className="grid gap-x-6 sm:grid-cols-2">
            {GO_SHORTCUTS.map(([k, , label]) => <li key={k} className="flex items-center justify-between border-b border-line py-2 text-sm"><span>{label}</span><Key>{k.toUpperCase()}</Key></li>)}
          </ul>
        </section>
      </div>
    </Modal>
  );
}
