import { Cloud, HardDrive, Link2 } from "lucide-react";
import type { Release } from "@/types";
import { formatBytes } from "@/lib/utils";

/** How much release-file storage is used in Firebase versus hosted elsewhere via links (which costs nothing here). */
export function StorageOverview({ releases }: { releases: Release[] }) {
  const files = releases.flatMap((r) => r.files.map((f) => ({ ...f, status: r.status })));
  const stored = files.filter((f) => f.source === "upload").reduce((t, f) => t + f.sizeBytes, 0);
  const linked = files.filter((f) => f.source === "link").reduce((t, f) => t + f.sizeBytes, 0);
  const archivedStored = files.filter((f) => f.source === "upload" && f.status === "archived").reduce((t, f) => t + f.sizeBytes, 0);
  const total = stored + linked;
  if (total === 0) return null;
  const pct = total ? (stored / total) * 100 : 0;

  return (
    <section className="mb-6 overflow-hidden rounded-xl3 bg-ink-900 p-6 text-white shadow-lift sm:p-7" aria-label="Storage used by release files">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="flex items-center gap-2 text-sm text-ink-200"><Cloud className="h-4 w-4 text-accent" aria-hidden />Release file storage</p>
          <p className="mt-2 font-display text-4xl font-extrabold tabular">{formatBytes(stored)}<span className="ml-2 text-base font-medium text-ink-300">used in Firebase</span></p>
        </div>
        {linked > 0 && (
          <p className="rounded-2xl bg-live/15 px-4 py-3 text-sm text-live ring-1 ring-live/25">
            <b className="font-display text-xl tabular">{formatBytes(linked)}</b><br />hosted on links, costs you no storage
          </p>
        )}
      </div>
      <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-white/10" role="img" aria-label={`${formatBytes(stored)} in Firebase, ${formatBytes(linked)} on links`}>
        <div className="bg-accent transition-[width]" style={{ width: `${pct}%` }} />
        <div className="bg-live/70" style={{ width: `${100 - pct}%` }} />
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-200">
        <li className="flex items-center gap-1.5"><HardDrive className="h-3.5 w-3.5 text-accent" aria-hidden />Uploaded to Firebase</li>
        <li className="flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5 text-live" aria-hidden />Hosted on a link (GitHub, etc.)</li>
      </ul>
      {archivedStored > 0 && <p className="mt-4 rounded-xl bg-white/[0.07] px-4 py-3 text-[13px] text-ink-100">Archived versions are still holding <b>{formatBytes(archivedStored)}</b> in Firebase. Open one and delete it to free the space.</p>}
    </section>
  );
}
