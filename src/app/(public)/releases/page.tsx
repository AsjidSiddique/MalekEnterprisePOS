import { PackageOpen } from "lucide-react";
import type { Metadata } from "next";
import { DownloadButton } from "@/components/marketing/DownloadButton";
import { PageBand } from "@/components/marketing/PageBand";
import { EmptyState } from "@/components/ui/States";
import { fetchPublishedReleases } from "@/lib/firebase/publicRest";
import { pickLatest } from "@/lib/releases/rules";
import { cn, formatBytes, formatDate } from "@/lib/utils";

export const revalidate = 60;
export const metadata: Metadata = { title: "Releases", description: "Release notes and download history for Malek Enterprise POS." };

export default async function ReleasesPage() {
  const releases = await fetchPublishedReleases();
  const latest = pickLatest(releases);

  return (
    <>
      <PageBand title="Release notes" lede="What changed in each version, with downloads for every published build." />
      <div className="bg-paper py-16">
        <div className="mx-auto max-w-4xl px-5">
          {releases.length === 0 ? (
            <div className="panel rounded-xl3"><EmptyState icon={PackageOpen} title="No releases published yet" description="Release notes will appear here as soon as the first version is published." /></div>
          ) : (
            <ol className="relative space-y-8 border-l-2 border-dashed border-ink-200 pl-8 sm:pl-12">
              {releases.map((r) => {
                const installer = r.files.find((f) => f.kind === "installer");
                const isLatest = latest?.id === r.id;
                return (
                  <li key={r.id} className="relative">
                    <span aria-hidden className={cn("absolute -left-[41px] top-7 h-4 w-4 rounded-full ring-4 ring-paper sm:-left-[57px]", isLatest ? "bg-accent" : "bg-ink-300")} />
                    <article className={cn("rounded-xl3 p-7 shadow-card ring-1 sm:p-8", isLatest ? "bg-surface ring-accent-strong/40 shadow-glow" : "bg-surface ring-line")}>
                      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                        <h2 className="display text-5xl tabular">v{r.version}</h2>
                        {isLatest && <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-ink">Latest</span>}
                        <span className="text-sm text-muted">{formatDate(r.releaseDate)}</span>
                      </div>
                      <p className="mt-2 text-lg font-medium text-ink-800">{r.title}</p>
                      {r.changes.length > 0 && (
                        <ul className="mt-5 space-y-2.5 text-[15px]">
                          {r.changes.map((c, i) => <li key={i} className="flex gap-3"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-strong" />{c}</li>)}
                        </ul>
                      )}
                      {installer && (
                        <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-line pt-5">
                          <DownloadButton releaseId={r.id} fileId={installer.id} size="md" variant={isLatest ? "primary" : "secondary"}>Download</DownloadButton>
                          <span className="text-sm text-muted">{installer.name} <span className="tabular">({formatBytes(installer.sizeBytes)})</span></span>
                        </div>
                      )}
                    </article>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </>
  );
}
