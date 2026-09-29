import { FileText, KeyRound, PackageOpen, ShieldCheck, Timer } from "lucide-react";
import type { Metadata } from "next";
import { CopyButton } from "@/components/marketing/CopyButton";
import { DownloadButton } from "@/components/marketing/DownloadButton";
import { PageBand } from "@/components/marketing/PageBand";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { fetchLatestRelease } from "@/lib/firebase/publicRest";
import { formatBytes, formatDate } from "@/lib/utils";

export const revalidate = 60;
export const metadata: Metadata = { title: "Download", description: "Download the latest Malek Enterprise POS installer for Windows." };

export default async function DownloadPage() {
  const release = await fetchLatestRelease();
  const installer = release?.files.find((f) => f.kind === "installer");
  const extras = release?.files.filter((f) => f.id !== installer?.id) ?? [];

  return (
    <>
      <PageBand title="Download Malek Enterprise POS" lede="Install the server on your shop PC first, then the POS on each till." />
      <div className="bg-paper py-14">
        <div className="mx-auto max-w-6xl px-5">
          {!release || !installer ? (
            <div className="panel rounded-xl3">
              <EmptyState icon={PackageOpen} title="No release is available yet" description="The first installer hasn't been published. Contact us and we'll send you the current build." action={<ButtonLink href="/contact" variant="dark">Contact us</ButtonLink>} />
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr]">
              <div className="space-y-6">
                <section className="relative overflow-hidden rounded-xl3 bg-surface p-8 shadow-lift ring-1 ring-line sm:p-10">
                  <div aria-hidden className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/25 blur-2xl" />
                  <p className="relative text-sm font-medium text-muted">Latest version, released {formatDate(release.releaseDate)}</p>
                  <h2 className="display relative mt-1 text-[84px] tabular text-ink-900 sm:text-[112px]">v{release.version}</h2>
                  <p className="relative mt-1 max-w-md text-[17px] font-medium text-ink-800">{release.title}</p>
                  <dl className="relative mt-6 flex flex-wrap gap-x-10 gap-y-3 text-sm">
                    <div><dt className="text-muted">Platform</dt><dd className="font-semibold">{release.platform}</dd></div>
                    <div><dt className="text-muted">Size</dt><dd className="font-semibold tabular">{formatBytes(installer.sizeBytes)}</dd></div>
                    <div className="min-w-0"><dt className="text-muted">File</dt><dd className="truncate font-semibold">{installer.name}</dd></div>
                  </dl>
                  <div className="relative mt-8 flex flex-wrap items-center gap-4">
                    <DownloadButton releaseId={release.id} fileId={installer.id} size="lg" variant="primary" className="h-14 px-8 text-lg">Download installer</DownloadButton>
                    <ButtonLink href="/releases" size="lg" variant="secondary">Release notes</ButtonLink>
                  </div>
                </section>

                <section className="rounded-xl3 bg-ink-900 p-7 text-white shadow-lift sm:p-8">
                  <h2 className="display-wide flex items-center gap-2.5 text-xl font-bold"><ShieldCheck className="h-5 w-5 text-live" aria-hidden />How this download is protected</h2>
                  <ul className="mt-5 grid gap-5 text-sm text-ink-200 sm:grid-cols-3">
                    <li className="flex gap-3"><Timer className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden /><span><b className="block text-white">Made when you click</b>The link is created for you and stops working after five minutes.</span></li>
                    <li className="flex gap-3"><KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden /><span><b className="block text-white">No public file address</b>The file&apos;s real location is never shown, so there&apos;s nothing to copy or scrape.</span></li>
                    <li className="flex gap-3"><FileText className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden /><span><b className="block text-white">Check it arrived intact</b>Compare the SHA-256 checksum below with your downloaded file.</span></li>
                  </ul>
                  {release.checksumSha256 && (
                    <div className="mt-6 rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">SHA-256 checksum</p>
                        <CopyButton value={release.checksumSha256} />
                      </div>
                      <p className="break-all font-receipt text-[12.5px] leading-relaxed text-accent">{release.checksumSha256}</p>
                      <p className="mt-3 text-xs text-ink-300">On Windows, open Command Prompt in the download folder and run <code className="rounded bg-white/10 px-1.5 py-0.5 font-receipt text-white">certutil -hashfile {installer.name} SHA256</code></p>
                    </div>
                  )}
                </section>
              </div>

              <div className="space-y-6">
                {release.installInstructions.length > 0 && (
                  <section className="rounded-xl3 bg-surface p-7 shadow-card ring-1 ring-line">
                    <h2 className="display-wide text-xl font-bold">Installing</h2>
                    <ol className="mt-5 space-y-4">
                      {release.installInstructions.map((s, i) => (
                        <li key={i} className="flex gap-3.5 text-[15px]"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent font-display text-sm font-extrabold text-accent-ink">{i + 1}</span><span className="pt-0.5">{s}</span></li>
                      ))}
                    </ol>
                  </section>
                )}
                {release.minRequirements.length > 0 && (
                  <section className="rounded-xl3 bg-surface p-7 shadow-card ring-1 ring-line">
                    <h2 className="display-wide text-xl font-bold">System requirements</h2>
                    <ul className="mt-4 divide-y divide-line text-[15px]">{release.minRequirements.map((r, i) => <li key={i} className="py-2.5">{r}</li>)}</ul>
                  </section>
                )}
                {extras.length > 0 && (
                  <section className="rounded-xl3 bg-surface p-7 shadow-card ring-1 ring-line">
                    <h2 className="display-wide text-xl font-bold">Other files</h2>
                    <ul className="mt-3 divide-y divide-line">
                      {extras.map((f) => (
                        <li key={f.id} className="flex items-center gap-3 py-3 text-[15px]">
                          <FileText className="h-4 w-4 shrink-0 text-ink-600" aria-hidden /><span className="min-w-0 flex-1 truncate">{f.name}</span><span className="text-xs text-muted tabular">{formatBytes(f.sizeBytes)}</span>
                          <DownloadButton releaseId={release.id} fileId={f.id} size="sm" variant="secondary" icon={false}>Get</DownloadButton>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
