"use client";

import { Building2, CreditCard, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { useAsyncData } from "@/hooks/useAsyncData";
import { cycleAmount, MONTHS_PER_CYCLE } from "@/lib/billing/lifecycle";
import { cn, errorMessage, formatDate, formatZAR } from "@/lib/utils";
import { listAuditForCustomer } from "@/services/auditService";
import { createShop, deleteCustomer, getCustomer, listShops, setCustomerStatus } from "@/services/customerService";
import { listInvoicesForCustomer } from "@/services/invoiceService";
import { listLicensesForCustomer } from "@/services/licenseService";
import { getPricing, setCustomerPrice } from "@/services/pricingService";
import { getSettings } from "@/services/settingsService";
import { listSubscriptionsForCustomer } from "@/services/subscriptionService";
import { listTerminalsForCustomer } from "@/services/terminalService";
import { useActor } from "./AuthProvider";
import { AuditList } from "./AuditList";
import { CustomerFormModal } from "./CustomerFormModal";
import { InvoiceFormModal } from "./InvoiceFormModal";
import { InvoiceTable } from "./InvoiceTable";
import { LicenseManager } from "./LicenseManager";
import { SubscriptionFormModal } from "./SubscriptionFormModal";
import { TerminalTable } from "./TerminalTable";

const Detail = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><dt className="text-xs text-muted">{label}</dt><dd className="mt-0.5 text-sm font-medium text-ink-900">{children || "—"}</dd></div>
);

export function CustomerDetail({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const actor = useActor();
  const { data, loading, error, reload } = useAsyncData(async () => {
    const [customer, shops, subscriptions, invoices, licenses, terminals, audit, pricing, settings] = await Promise.all([
      getCustomer(id), listShops(id), listSubscriptionsForCustomer(id), listInvoicesForCustomer(id), listLicensesForCustomer(id),
      listTerminalsForCustomer(id), listAuditForCustomer(id), getPricing().catch(() => null), getSettings(),
    ]);
    return { customer, shops, subscriptions, invoices: invoices.sort((a, b) => b.issueDate.localeCompare(a.issueDate)), licenses, terminals, audit, pricing, settings };
  }, [id]);

  const [editing, setEditing] = useState(false);
  const [subForm, setSubForm] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState(false);
  const [shopForm, setShopForm] = useState(false);
  const [shopName, setShopName] = useState("");
  const [statusConfirm, setStatusConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [priceInput, setPriceInput] = useState<string | null>(null);

  if (error) return <ErrorState title="Couldn't load this customer" error={error} onRetry={reload} />;
  if (loading && !data) return <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-96" /></div>;
  if (!data) return null;
  if (!data.customer) {
    return <div className="panel"><EmptyState icon={Building2} title="Customer not found" description="It may have been deleted." action={<Link href="/admin/customers" className="text-sm font-medium underline">Back to customers</Link>} /></div>;
  }

  const { customer, shops, subscriptions, invoices, licenses, terminals, audit, pricing, settings } = data;
  const sub = subscriptions.find((s) => s.status !== "CANCELLED") ?? subscriptions[0];
  const customerName = () => customer.businessName;
  const nextStatus = customer.status === "active" ? "inactive" : "active";
  const price = priceInput ?? String(customer.pricePerTerminal);
  const defaultPlan = pricing?.plans.find((p) => p.name === customer.plan) ?? pricing?.plans.find((p) => p.highlighted) ?? pricing?.plans[0];

  const savePrice = async () => {
    const n = Number(price);
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return toast.error("Enter a valid price.");
    try { await setCustomerPrice(actor, customer, n, sub); toast.success("Customer price saved."); setPriceInput(null); reload(); } catch (e) { toast.error(errorMessage(e)); }
  };

  const overview = (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="panel p-5">
        <h2 className="mb-4 text-base font-semibold">Contact</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="Contact name">{customer.name}</Detail>
          <Detail label="Email"><a href={`mailto:${customer.email}`} className="underline underline-offset-4">{customer.email}</a></Detail>
          <Detail label="Phone">{customer.phone}</Detail>
          <Detail label="Country">{customer.country}</Detail>
          <div className="sm:col-span-2"><Detail label="Address">{customer.address}</Detail></div>
          <div className="sm:col-span-2"><Detail label="Internal notes"><span className="whitespace-pre-wrap font-normal">{customer.notes}</span></Detail></div>
        </dl>
      </section>
      <section className="panel p-5">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold">Shops</h2><Button size="sm" variant="ghost" onClick={() => setShopForm(true)}><Plus className="h-4 w-4" aria-hidden />Add shop</Button></div>
        {shops.length === 0 ? <p className="text-sm text-muted">No shops yet.</p> : <ul className="divide-y divide-line">{shops.map((s) => <li key={s.id} className="py-2.5 text-sm"><p className="font-medium">{s.name}</p>{s.address && <p className="text-xs text-muted">{s.address}</p>}</li>)}</ul>}
      </section>
    </div>
  );

  const billing = (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="panel p-5">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold">Subscription</h2>{sub && <Button size="sm" variant="secondary" onClick={() => setSubForm(true)}>Edit</Button>}</div>
        {!sub ? (
          <EmptyState icon={CreditCard} title="No subscription" description="Create one to start invoicing and issuing licences." action={<Button variant="dark" onClick={() => setSubForm(true)}>Create subscription</Button>} />
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="Status"><StatusBadge status={sub.status} /></Detail>
            <Detail label="Plan">{sub.plan}</Detail>
            <Detail label="Terminal limit">{sub.terminalLimit}</Detail>
            <Detail label="Billing">{sub.billingFrequency}, {formatZAR(cycleAmount(sub.terminalLimit, sub.pricePerTerminal, sub.billingFrequency))} before VAT</Detail>
            <Detail label="Next billing date">{formatDate(sub.nextBillingDate)}</Detail>
            <Detail label="Grace period">{sub.gracePeriodDays} days</Detail>
            <Detail label="Started">{formatDate(sub.startDate)}</Detail>
            <Detail label="Auto-renewal">{sub.autoRenewal ? "On" : "Off"}</Detail>
          </dl>
        )}
      </section>
      <section className="panel p-5">
        <h2 className="mb-1 text-base font-semibold">Customer-specific price</h2>
        <p className="mb-4 text-sm text-muted">Charged per terminal per month instead of the public price.{defaultPlan ? ` Public price for ${defaultPlan.name}: ${formatZAR(defaultPlan.pricePerTerminal)}.` : ""}</p>
        <div className="flex items-end gap-3">
          <TextField label="ZAR per terminal / month" inputMode="decimal" className="flex-1" value={price} onChange={(e) => setPriceInput(e.target.value)} />
          <Button variant="dark" onClick={savePrice} disabled={priceInput === null || priceInput === String(customer.pricePerTerminal)}>Save price</Button>
        </div>
        <p className="mt-3 text-xs text-muted">Applies to the next invoice. Existing invoices don&apos;t change.</p>
      </section>
    </div>
  );

  return (
    <>
      <PageHeader
        title={customer.businessName}
        leading={<Avatar name={customer.businessName} size="lg" />}
        description={`${customer.name}, ${customer.email}`}
        actions={<>
          <StatusBadge status={customer.status} />
          <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
          <Button variant="secondary" onClick={() => setStatusConfirm(true)}>{customer.status === "active" ? "Deactivate" : "Activate"}</Button>
          <Button variant="ghost" className="text-[#A22B3B]" onClick={() => setDeleteConfirm(true)}>Delete</Button>
        </>}
      />
      <dl className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Monthly, before VAT", sub && (sub.status === "ACTIVE" || sub.status === "GRACE") ? formatZAR(cycleAmount(sub.terminalLimit, sub.pricePerTerminal, sub.billingFrequency) / MONTHS_PER_CYCLE[sub.billingFrequency]) : "Not billing", sub ? `${sub.plan}, ${sub.billingFrequency}` : "No subscription"],
          ["Tills in use", `${terminals.filter((t) => t.status === "ACTIVE").length} of ${sub?.terminalLimit ?? customer.terminals}`, "Active terminals against the limit"],
          ["Owes", formatZAR(invoices.filter((i) => i.status === "PENDING" || i.status === "OVERDUE").reduce((t, i) => t + i.total, 0)), `${invoices.filter((i) => i.status === "OVERDUE").length} overdue invoice(s)`],
          ["Customer since", formatDate(customer.createdAt), `${invoices.filter((i) => i.status === "PAID").length} invoices paid`],
        ].map(([label, value, hint], i) => (
          <div key={label} className={cn("rounded-xl2 p-5 shadow-card", i === 0 ? "bg-ink-900 text-white" : "border border-line bg-surface")}>
            <dt className={cn("text-sm", i === 0 ? "text-ink-200" : "text-muted")}>{label}</dt>
            <dd className="mt-2 font-display text-[26px] font-extrabold leading-none tabular">{value}</dd>
            <dd className={cn("mt-2 text-xs", i === 0 ? "text-ink-300" : "text-muted")}>{hint}</dd>
          </div>
        ))}
      </dl>
      <Tabs tabs={[
        { id: "overview", label: "Overview", content: overview },
        { id: "billing", label: "Billing", content: billing },
        { id: "licences", label: "Licences", count: licenses.length, content: <LicenseManager fixedCustomerId={customer.id} licenses={licenses} customers={[customer]} subscriptions={subscriptions} terminals={terminals} onChanged={reload} /> },
        { id: "terminals", label: "Terminals", count: terminals.length, content: <TerminalTable showCustomer={false} terminals={terminals} licenses={licenses} customerName={customerName} onChanged={reload} /> },
        { id: "invoices", label: "Invoices", count: invoices.length, content: <InvoiceTable showCustomer={false} invoices={invoices} customerName={customerName} onChanged={reload} toolbar={<Button size="sm" variant="dark" onClick={() => setInvoiceForm(true)}><Plus className="h-4 w-4" aria-hidden />New invoice</Button>} /> },
        { id: "activity", label: "Activity", content: <AuditList logs={audit} /> },
      ]} />

      {editing && <CustomerFormModal customer={customer} pricing={pricing} onClose={() => setEditing(false)} onSaved={reload} />}
      {subForm && <SubscriptionFormModal customers={[customer]} settings={settings} subscription={sub} fixedCustomerId={customer.id} onClose={() => setSubForm(false)} onSaved={reload} />}
      {invoiceForm && <InvoiceFormModal customers={[customer]} subscriptions={subscriptions} settings={settings} presetCustomerId={customer.id} onClose={() => setInvoiceForm(false)} onSaved={reload} />}

      {shopForm && (
        <Modal open onClose={() => setShopForm(false)} title="Add shop" size="sm"
          footer={<><Button variant="secondary" onClick={() => setShopForm(false)}>Cancel</Button>
            <Button variant="dark" disabled={shopName.trim().length < 2} onClick={async () => { try { await createShop(actor, { customerId: customer.id, name: shopName.trim(), address: "" }); toast.success("Shop added."); setShopForm(false); setShopName(""); reload(); } catch (e) { toast.error(errorMessage(e)); } }}>Add shop</Button></>}>
          <TextField label="Shop name" value={shopName} onChange={(e) => setShopName(e.target.value)} data-autofocus />
        </Modal>
      )}

      <ConfirmDialog open={statusConfirm} title={`${nextStatus === "inactive" ? "Deactivate" : "Activate"} customer`} tone={nextStatus === "inactive" ? "danger" : "primary"}
        confirmLabel={nextStatus === "inactive" ? "Deactivate" : "Activate"} description={nextStatus === "inactive" ? "Deactivating keeps all billing history. It doesn't suspend their licence by itself." : "The customer will be marked active again."}
        details={[{ label: "Customer", value: customer.businessName }]} onClose={() => setStatusConfirm(false)}
        onConfirm={async () => { try { await setCustomerStatus(actor, customer, nextStatus); toast.success("Customer updated."); setStatusConfirm(false); reload(); } catch (e) { toast.error(errorMessage(e)); } }} />

      <ConfirmDialog open={deleteConfirm} title="Delete customer" confirmLabel="Delete customer" requireText={customer.businessName}
        description="This permanently deletes the customer record. Customers with subscriptions, invoices, licences or terminals can't be deleted; deactivate them instead."
        onClose={() => setDeleteConfirm(false)}
        onConfirm={async () => { try { await deleteCustomer(actor, customer); toast.success("Customer deleted."); router.replace("/admin/customers"); } catch (e) { toast.error(errorMessage(e)); setDeleteConfirm(false); } }} />
    </>
  );
}
