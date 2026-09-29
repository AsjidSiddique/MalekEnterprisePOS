"use client";

import { TerminalTable } from "@/components/admin/TerminalTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState, TableSkeleton } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useAsyncData";
import { listCustomers } from "@/services/customerService";
import { listLicenses } from "@/services/licenseService";
import { listTerminals } from "@/services/terminalService";

export default function TerminalsPage() {
  const { data, loading, error, reload } = useAsyncData(async () => {
    const [terminals, licenses, customers] = await Promise.all([listTerminals(), listLicenses(), listCustomers()]);
    return { terminals, licenses, customers };
  }, []);
  const name = (id: string) => data?.customers.find((c) => c.id === id)?.businessName ?? "Unknown customer";
  return (
    <>
      <PageHeader title="Terminals" description="Every till registered against a licence. Revoke one to unlink it and free the slot." />
      {error ? <ErrorState title="Couldn't load terminals" error={error} onRetry={reload} /> : loading && !data ? <TableSkeleton /> : data && <TerminalTable terminals={data.terminals} licenses={data.licenses} customerName={name} onChanged={reload} />}
    </>
  );
}
