"use client";

import { HardDrive, Link2, Plus, Rocket } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ReleaseEditor } from "@/components/admin/ReleaseEditor";
import { StorageOverview } from "@/components/admin/StorageOverview";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useAsyncData";
import { compareVersions } from "@/lib/releases/rules";
import { formatBytes, formatDate } from "@/lib/utils";
import { listDownloadStats, listReleases } from "@/services/releaseService";
import { getSettings } from "@/services/settingsService";
import type { Release } from "@/types";

function ReleasesView() {
  const router = useRouter();
  const params = useSearchParams();
  const { data, loading, error, reload } = useAsyncData(async () => {
    const [releases, settings, downloads] = await Promise.all([listReleases(), getSettings(), listDownloadStats().catch(() => [])]);
    return { releases, settings, downloads };
  }, []);
  const [editing, setEditing] = useState<{ release?: Release } | null>(null);
  useEffect(() => { if (params.get("new") === "1") setEditing({}); }, [params]);
  const add = <Button variant="dark" onClick={() => setEditing({})}><Plus className="h-4 w-4" aria-hidden />New release</Button>;
  const count = (id: string) => data?.downloads.find((d) => d.releaseId === id)?.total ?? 0;

  return (
    <>
      <PageHeader title="Releases" description="Add installers, publish versions and control exactly who can download what." actions={add} />
      {error ? <ErrorState title="Couldn't load releases" error={error} onRetry={reload} /> : loading && !data ? <TableSkeleton /> : data && (<>
        <StorageOverview releases={data.releases} />
        <DataTable
          caption="Releases" rows={[...data.releases].sort((a, b) => compareVersions(b.version, a.version))} rowKey={(r) => r.id} searchPlaceholder="Search releases" searchText={(r) => `${r.version} ${r.title}`}
          onRowClick={(r) => setEditing({ release: r })}
          csv={{ filename: "releases", columns: [{ header: "Version", value: (r) => r.version }, { header: "Title", value: (r) => r.title }, { header: "Status", value: (r) => r.status }, { header: "Release date", value: (r) => r.releaseDate }, { header: "Downloads", value: (r) => count(r.id) }] }}
          filters={[{ key: "status", label: "Status", options: ["draft", "published", "archived"].map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })), predicate: (r, v) => r.status === v }]}
          empty={<EmptyState icon={Rocket} title="No releases yet" description="Create a release, add the installer by upload or link, then publish it." action={add} />}
          columns={[
            { key: "version", header: "Version", sortValue: (r) => r.version, render: (r) => <span className="inline-flex items-center gap-2 font-display text-base font-bold tabular">v{r.version}{r.isLatest && r.status === "published" && <Badge tone="accent">Latest</Badge>}</span> },
            { key: "title", header: "Title", render: (r) => <span className="text-ink-800">{r.title}</span> },
            { key: "status", header: "Status", sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
            { key: "source", header: "Installer", render: (r) => {
              const f = r.files.find((x) => x.kind === "installer");
              return f ? <span className="inline-flex items-center gap-2 text-[13px]">{f.source === "link" ? <Link2 className="h-4 w-4 text-info" aria-hidden /> : <HardDrive className="h-4 w-4 text-ink-600" aria-hidden />}<span><span className="block font-medium">{f.source === "link" ? `Link on ${f.linkHost}` : "Uploaded"}</span><span className="block text-xs text-muted tabular">{f.sizeBytes ? formatBytes(f.sizeBytes) : "size unknown"}</span></span></span> : <span className="text-sm text-muted">Not added yet</span>;
            } },
            { key: "date", header: "Released", sortValue: (r) => r.releaseDate, render: (r) => formatDate(r.releaseDate) },
            { key: "downloads", header: "Downloads", align: "right", sortValue: (r) => count(r.id), render: (r) => count(r.id) },
          ]}
        />
      </>)}
      {editing && data && <ReleaseEditor key={editing.release?.id ?? "new"} release={editing.release} settings={data.settings} onClose={() => { setEditing(null); if (params.get("new")) router.replace("/admin/releases"); }} onChanged={reload} />}
    </>
  );
}

export default function ReleasesPage() {
  return <Suspense fallback={<TableSkeleton />}><ReleasesView /></Suspense>;
}
