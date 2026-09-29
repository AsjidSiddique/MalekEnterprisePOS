"use client";

import { Bell, CheckCircle2, CircleAlert, Inbox, Plus } from "lucide-react";
import { useState } from "react";
import { NotificationFormModal } from "@/components/admin/NotificationFormModal";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { useAsyncData } from "@/hooks/useAsyncData";
import { adminFetch } from "@/lib/api-client";
import { errorMessage, formatDateTime } from "@/lib/utils";
import { listCustomers } from "@/services/customerService";
import { listInquiries, listNotifications, sendNotification } from "@/services/notificationService";

interface SystemStatus { checks: { id: string; label: string; ok: boolean; detail: string }[] }

export default function NotificationsPage() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsyncData(async () => {
    const [notifications, inquiries, customers] = await Promise.all([listNotifications(), listInquiries(), listCustomers()]);
    return { notifications, inquiries, customers };
  }, []);
  const status = useAsyncData(() => adminFetch<SystemStatus>("/api/admin/system-status", undefined, "GET"), []);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const name = (id: string | null) => (id ? data?.customers.find((c) => c.id === id)?.businessName ?? "Unknown" : "—");

  const send = async (id: string) => {
    setSending(id);
    try {
      const r = await sendNotification(id);
      if (r.status === "sent") toast.success("Email sent."); else toast.error(r.error ?? "The email couldn't be sent.");
      reload();
    } catch (e) { toast.error(errorMessage(e)); } finally { setSending(null); }
  };

  const add = <Button variant="dark" onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden />New notification</Button>;

  const queue = data && (
    <DataTable
      caption="Notifications" rows={data.notifications} rowKey={(n) => n.id} searchPlaceholder="Search notifications" searchText={(n) => `${n.title} ${n.recipient} ${name(n.customerId)}`}
      filters={[{ key: "status", label: "Status", options: ["queued", "sent", "failed", "read"].map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })), predicate: (n, v) => n.status === v }]}
      toolbar={add}
      empty={<EmptyState icon={Bell} title="No notifications yet" description="Payment reminders and licence warnings created by the daily billing job appear here, alongside anything you queue by hand." />}
      columns={[
        { key: "date", header: "Created", sortValue: (n) => n.createdAt ?? "", render: (n) => <span className="text-muted">{formatDateTime(n.createdAt)}</span> },
        { key: "title", header: "Message", render: (n) => <div><p className="font-medium">{n.title}</p><p className="text-xs text-muted">{n.type.replace(/_/g, " ")} · {n.channel.replace("_", "-")}</p></div> },
        { key: "customer", header: "Customer", render: (n) => name(n.customerId) },
        { key: "to", header: "To", render: (n) => n.recipient || "—" },
        { key: "status", header: "Status", render: (n) => <div><StatusBadge status={n.status} />{n.error && <p className="mt-1 max-w-[16rem] truncate text-xs text-[#A22B3B]" title={n.error}>{n.error}</p>}</div> },
        { key: "action", header: "", align: "right", render: (n) => n.channel === "email" && (n.status === "queued" || n.status === "failed") ? <Button size="sm" variant="secondary" loading={sending === n.id} onClick={() => send(n.id)}>Send now</Button> : null },
      ]}
    />
  );

  const inbox = data && (
    <DataTable
      caption="Contact form messages" rows={data.inquiries} rowKey={(i) => i.id} searchPlaceholder="Search messages" searchText={(i) => `${i.name} ${i.email} ${i.business} ${i.message}`}
      empty={<EmptyState icon={Inbox} title="No messages yet" description="Messages sent through the public contact form arrive here." />}
      columns={[
        { key: "date", header: "Received", sortValue: (i) => i.createdAt ?? "", render: (i) => <span className="text-muted">{formatDateTime(i.createdAt)}</span> },
        { key: "from", header: "From", render: (i) => <div><p className="font-medium">{i.name}</p><a href={`mailto:${i.email}`} className="text-xs text-muted underline underline-offset-2">{i.email}</a>{i.phone && <p className="text-xs text-muted">{i.phone}</p>}</div> },
        { key: "business", header: "Business", render: (i) => i.business || "—" },
        { key: "message", header: "Message", render: (i) => <p className="max-w-md whitespace-pre-wrap text-[13px]">{i.message}</p> },
      ]}
    />
  );

  const delivery = (
    <div className="panel divide-y divide-line">
      {status.loading && !status.data ? <p className="p-5 text-sm text-muted">Checking the server…</p> : status.error ? <p className="p-5 text-sm text-[#A22B3B]">{status.error.message}</p> : status.data?.checks.map((c) => (
        <div key={c.id} className="flex items-start gap-3 p-4">
          {c.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ok" aria-hidden /> : <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warn" aria-hidden />}
          <div><p className="font-medium">{c.label}</p><p className="text-sm text-muted">{c.detail}</p></div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <PageHeader title="Notifications" description="Reminders and warnings for customers, the contact-form inbox, and what's connected for delivery." />
      {error ? <ErrorState title="Couldn't load notifications" error={error} onRetry={reload} /> : loading && !data ? <TableSkeleton /> : data && (
        <Tabs tabs={[
          { id: "queue", label: "Notifications", count: data.notifications.length, content: queue },
          { id: "inbox", label: "Contact messages", count: data.inquiries.length, content: inbox },
          { id: "delivery", label: "Delivery setup", content: delivery },
        ]} />
      )}
      {creating && data && <NotificationFormModal customers={data.customers} onClose={() => setCreating(false)} onSaved={reload} />}
    </>
  );
}
