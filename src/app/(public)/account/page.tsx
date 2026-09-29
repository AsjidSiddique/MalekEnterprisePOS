import type { Metadata } from "next";
import { AccountPortal } from "@/components/account/AccountPortal";
import { PageBand } from "@/components/marketing/PageBand";

export const metadata: Metadata = { title: "My account", description: "Sign in to manage your Malek Enterprise POS plan, licence key and invoices.", robots: { index: false } };

export default function AccountPage() {
  return (
    <>
      <PageBand title="My account" lede="Buy or upgrade your plan, see your licence key, and keep track of invoices and payments." />
      <div className="bg-paper py-12">
        <div className="mx-auto max-w-6xl px-5"><AccountPortal /></div>
      </div>
    </>
  );
}
