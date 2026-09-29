"use client";

import { LicenseManager } from "@/components/admin/LicenseManager";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState, TableSkeleton } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useAsyncData";
import { listCustomers } from "@/services/customerService";
import { listLicenses } from "@/services/licenseService";
import { listSubscriptions } from "@/services/subscriptionService";
import { listTerminals } from "@/services/terminalService";

export default function LicensesPage() {
  const { data, loading, error, reload } = useAsyncData(async () => {
    const [licenses, customers, subscriptions, terminals] = await Promise.all([listLicenses(), listCustomers(), listSubscriptions(), listTerminals()]);
    return { licenses, customers, subscriptions, terminals };
  }, []);
  return (
    <>
      <PageHeader title="Licences" description="Keys are generated on the server and stored as hashes. A key is shown once, when it's created." />
      {error ? <ErrorState title="Couldn't load licences" error={error} onRetry={reload} /> : loading && !data ? <TableSkeleton /> : data && <LicenseManager {...data} onChanged={reload} />}
    </>
  );
}
