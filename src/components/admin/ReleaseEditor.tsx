"use client";

import { CheckCircle2, CircleAlert, Clock, EyeOff, ExternalLink, GitBranch, HardDrive, Link2, Search, Share2, ShieldCheck, Trash2, TriangleAlert, UploadCloud } from "lucide-react";
import { useCallback, useRef, useState, type DragEvent, type FormEvent } from "react";
import type { AppSettings, LinkDeliveryMode, Release, ReleaseFile, ReleaseFileKind, ShareLink } from "@/types";
import { CopyButton } from "@/components/marketing/CopyButton";
import { MonthBars } from "./charts";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useForm } from "@/hooks/useForm";
import { sha256File } from "@/lib/checksum";
import { lastDays } from "@/lib/dashboard";
import { todayISO } from "@/lib/dates";
import { releaseSchema } from "@/lib/validation/schemas";
import { cn, errorMessage, formatBytes, formatDateTime, timeAgo } from "@/lib/utils";
import {
  addReleaseLink, archiveRelease, checksumForLinkedFile, createRelease, createShareLink, deleteRelease, getRelease, listDownloadStats, listShareLinks, publishRelease,
  findGithubReleases, removeReleaseFile, revokeShareLink, testReleaseLink, updateRelease, uploadReleaseFile, validateUpload, type GithubLookup, type LinkProbeResult,
} from "@/services/releaseService";
import { useActor } from "./AuthProvider";

const KINDS: { value: ReleaseFileKind; label: string }[] = [
  { value: "installer", label: "Installer (.exe, .msi, .zip)" },
  { value: "checksums", label: "Checksums file" },
  { value: "documentation", label: "Documentation" },
  { value: "sql", label: "SQL / database scripts" },
  { value: "other", label: "Other" },
];

interface Props { release?: Release; settings: AppSettings; onClose: () => void; onChanged: () => void }
type Source = "upload" | "link";

function SourceChoice({ value, onChange }: { value: Source; onChange: (s: Source) => void }) {
  const opts = [
    { id: "upload" as const, icon: UploadCloud, title: "Upload the file", text: "Stored securely with us. Simple, but it uses your Firebase storage: a 500 MB installer takes 500 MB, and every new version adds the same again." },
    { id: "link" as const, icon: Link2, title: "Use a download link", text: "Keep the file elsewhere, such as a GitHub release, and paste its direct link. Uses no storage here." },
  ];
  return (
    <div role="radiogroup" aria-label="How to add the file" className="grid gap-3 sm:grid-cols-2">
      {opts.map(({ id, icon: Icon, title, text }) => (
        <button key={id} type="button" role="radio" aria-checked={value === id} onClick={() => onChange(id)}
          className={cn("flex gap-3 rounded-2xl border-2 p-4 text-left transition", value === id ? "border-ink-900 bg-ink-900/[0.03] shadow-card" : "border-line hover:border-ink-300")}>
          <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", value === id ? "bg-ink-900 text-accent" : "bg-ink-100 text-ink-700")}><Icon className="h-5 w-5" aria-hidden /></span>
          <span><span className="block text-[15px] font-bold">{title}</span><span className="mt-0.5 block text-[13px] leading-snug text-muted">{text}</span></span>
        </button>
      ))}
    </div>
  );
}

export function ReleaseEditor({ release: initial, settings, onClose, onChanged }: Props) {
  const actor = useActor();
  const toast = useToast();
  const [release, setRelease] = useState<Release | null>(initial ?? null);
  const { values, set, errors, validate } = useForm(releaseSchema, {
    version: initial?.version ?? "", title: initial?.title ?? "", releaseDate: initial?.releaseDate ?? todayISO(), platform: initial?.platform ?? "Windows",
    changes: (initial?.changes ?? []).join("\n"), minRequirements: (initial?.minRequirements ?? []).join("\n"),
    installInstructions: (initial?.installInstructions ?? []).join("\n"), checksumSha256: initial?.checksumSha256 ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [setAsLatest, setSetAsLatest] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);

  // Adding a file
  const [source, setSource] = useState<Source>("upload");
  const [kind, setKind] = useState<ReleaseFileKind>("installer");
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<{ pct: number; speed: number; eta: number } | null>(null);
  const [hashing, setHashing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [mode, setMode] = useState<LinkDeliveryMode>("redirect");
  const [gh, setGh] = useState<{ repo: string; busy: boolean; result: GithubLookup | null }>({ repo: "", busy: false, result: null });
  const [probe, setProbe] = useState<LinkProbeResult | null>(null);
  const [linkBusy, setLinkBusy] = useState<"test" | "add" | null>(null);
  const [hashingLink, setHashingLink] = useState<string | null>(null);

  const extras = useAsyncData(async () => {
    if (!release) return { shares: [] as ShareLink[], downloads: null };
    const [shares, all] = await Promise.all([listShareLinks(release.id).catch(() => [] as ShareLink[]), listDownloadStats().catch(() => [])]);
    return { shares, downloads: all.find((d) => d.releaseId === release.id) ?? null };
  }, [release?.id]);

  const refresh = useCallback(async (id: string) => { const fresh = await getRelease(id); if (fresh) setRelease(fresh); onChanged(); extras.reload(); }, [onChanged, extras]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const data = validate();
    if (!data) return;
    setSaving(true);
    try {
      if (release) { await updateRelease(actor, release, data); await refresh(release.id); toast.success("Release saved."); }
      else { const id = await createRelease(actor, data); await refresh(id); toast.success("Draft created. Now add the installer."); }
    } catch (err) { toast.error(errorMessage(err)); } finally { setSaving(false); }
  };

  const chooseFile = (f: File | null) => { setFile(f); if (f && /\.(exe|msi)$/i.test(f.name)) setKind("installer"); };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); chooseFile(e.dataTransfer.files?.[0] ?? null); };

  const upload = async () => {
    if (!release || !file) return;
    const problem = validateUpload(file, kind);
    if (problem) return toast.error(problem);
    const started = Date.now();
    setProgress({ pct: 0, speed: 0, eta: 0 });
    try {
      await uploadReleaseFile(actor, release, file, kind, (pct) => {
        const secs = Math.max((Date.now() - started) / 1000, 0.1);
        const done = (pct / 100) * file.size;
        const speed = done / secs;
        setProgress({ pct, speed, eta: speed > 0 ? (file.size - done) / speed : 0 });
      });
      toast.success(`${file.name} uploaded.`);
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      await refresh(release.id);
    } catch (err) { toast.error(errorMessage(err, "Upload failed.")); } finally { setProgress(null); }
  };

  const calcChecksum = async () => {
    if (!file) return;
    if (file.size > 512 * 1024 ** 2) return toast.error("That file is too large to check in the browser. Paste its SHA-256 instead.");
    setHashing(true);
    try { set("checksumSha256", await sha256File(file)); toast.success("Checksum filled in on the Details tab. Save the release to keep it."); } catch (err) { toast.error(errorMessage(err)); } finally { setHashing(false); }
  };

  const findOnGithub = async () => {
    setGh((g) => ({ ...g, busy: true, result: null }));
    try { const result = await findGithubReleases(gh.repo); setGh((g) => ({ ...g, busy: false, result })); }
    catch (err) { setGh((g) => ({ ...g, busy: false })); toast.error(errorMessage(err)); }
  };

  const pickAsset = (a: { name: string; url: string; apiUrl: string }) => {
    const priv = gh.result?.private ?? false;
    setUrl(priv ? a.apiUrl : a.url); setLinkName(a.name); setMode(priv ? "proxy" : "redirect"); setProbe(null);
    if (/\.(exe|msi)$/i.test(a.name)) setKind("installer");
    toast.success("Filled in below. Check the link, then add it.");
  };

  const checkLink = async () => {
    setLinkBusy("test"); setProbe(null);
    try {
      const p = await testReleaseLink(url);
      setProbe(p);
      if (p.ok && !linkName) setLinkName(p.fileName);
    } catch (err) { toast.error(errorMessage(err)); } finally { setLinkBusy(null); }
  };

  const addLink = async () => {
    if (!release) return;
    setLinkBusy("add");
    try {
      await addReleaseLink({ releaseId: release.id, url, name: linkName || undefined, kind, deliveryMode: mode });
      toast.success("Link added. The address is now stored privately.");
      setUrl(""); setLinkName(""); setProbe(null);
      await refresh(release.id);
    } catch (err) { toast.error(errorMessage(err)); } finally { setLinkBusy(null); }
  };

  const hashLinked = async (f: ReleaseFile) => {
    if (!release) return;
    setHashingLink(f.id);
    try { const r = await checksumForLinkedFile(release.id, f.id); set("checksumSha256", r.sha256); toast.success("Checksum calculated and filled in on the Details tab. Save the release to keep it."); }
    catch (err) { toast.error(errorMessage(err)); } finally { setHashingLink(null); }
  };

  const publish = async () => {
    if (!release) return;
    setPublishing(true);
    try { await publishRelease(actor, release, { setAsLatest, requireChecksum: settings.releases.requireChecksum }); toast.success(`v${release.version} is live on the download page.`); await refresh(release.id); }
    catch (err) { toast.error(errorMessage(err)); } finally { setPublishing(false); }
  };

  const installer = release?.files.find((f) => f.kind === "installer");
  const dl = extras.data?.downloads;

  // ── Tabs ──
  const details = (
    <form onSubmit={save} noValidate className="grid gap-4 sm:grid-cols-2">
      <TextField label="Version" placeholder="1.0.0" value={values.version} onChange={(e) => set("version", e.target.value)} error={errors.version} />
      <TextField label="Release date" type="date" value={values.releaseDate} onChange={(e) => set("releaseDate", e.target.value)} error={errors.releaseDate} />
      <TextField label="Title" className="sm:col-span-2" value={values.title} onChange={(e) => set("title", e.target.value)} error={errors.title} />
      <TextField label="Platform" value={values.platform} onChange={(e) => set("platform", e.target.value)} error={errors.platform} />
      <TextField label="SHA-256 checksum" value={values.checksumSha256} onChange={(e) => set("checksumSha256", e.target.value)} error={errors.checksumSha256} hint="64 hex characters, shown on the download page. On Windows, run: certutil -hashfile YourFile.exe SHA256" />
      <TextAreaField label="What changed (one per line)" rows={5} className="sm:col-span-2" value={values.changes} onChange={(e) => set("changes", e.target.value)} error={errors.changes} />
      <TextAreaField label="System requirements (one per line)" rows={3} value={values.minRequirements} onChange={(e) => set("minRequirements", e.target.value)} error={errors.minRequirements} />
      <TextAreaField label="Install steps (one per line)" rows={3} value={values.installInstructions} onChange={(e) => set("installInstructions", e.target.value)} error={errors.installInstructions} />
      <div className="sm:col-span-2"><Button type="submit" variant="dark" loading={saving}>{release ? "Save details" : "Create draft"}</Button></div>
    </form>
  );

  const filesTab = release && (
    <div className="space-y-6">
      <div className="flex gap-3 rounded-2xl bg-ink-900 p-4 text-[13px] text-ink-200">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-live" aria-hidden />
        <p><b className="text-white">Files are never listed publicly.</b> Visitors get a link made when they click that stops working after five minutes. Uploaded files can&apos;t be opened directly. Linked files stay completely hidden with <b className="text-white">Hide the link</b>; with <b className="text-white">Send them to the link</b> the visitor goes to the file&apos;s host, so its address is visible to them.</p>
      </div>

      {release.files.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {release.files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", f.source === "link" ? "bg-info/10 text-info" : "bg-ink-100 text-ink-700")}>{f.source === "link" ? <Link2 className="h-4 w-4" aria-hidden /> : <HardDrive className="h-4 w-4" aria-hidden />}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{f.name}</span>
                <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                  <span>{KINDS.find((k) => k.value === f.kind)?.label.split(" (")[0]}</span>
                  <span aria-hidden>•</span>
                  <span>{f.source === "link" ? `Link on ${f.linkHost}` : "Uploaded"}</span>
                  {f.source === "link" && <span className="inline-flex items-center gap-1 font-medium text-ink-700">{f.deliveryMode === "proxy" ? <><EyeOff className="h-3 w-3" aria-hidden />address hidden</> : <><ExternalLink className="h-3 w-3" aria-hidden />visitors sent to it</>}</span>}
                  {f.sizeBytes > 0 && <span className="tabular">{formatBytes(f.sizeBytes)}</span>}
                  {dl?.files[f.id] ? <span className="tabular">{dl.files[f.id]} downloads</span> : null}
                </span>
              </span>
              <span className="flex items-center gap-1">
                {f.source === "link" && f.kind === "installer" && (
                  <Button size="sm" variant="ghost" onClick={() => hashLinked(f)} loading={hashingLink === f.id} title="Our server downloads the file once to work out its SHA-256">Get checksum</Button>
                )}
                <button type="button" aria-label={`Remove ${f.name}`} className="rounded-lg p-2 text-muted hover:bg-bad/10 hover:text-bad"
                  onClick={async () => { try { await removeReleaseFile(actor, release, f); await refresh(release.id); toast.success("File removed."); } catch (err) { toast.error(errorMessage(err)); } }}><Trash2 className="h-4 w-4" /></button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-2xl border border-line bg-paper/60 p-4 sm:p-5">
        <h3 className="mb-3 font-display text-lg font-bold">{release.files.length === 0 ? "Add the installer" : "Add or replace a file"}</h3>
        <SourceChoice value={source} onChange={(s) => { setSource(s); setProbe(null); }} />

        <div className="mt-4">
          <SelectField label="What is this file?" value={kind} onChange={(e) => setKind(e.target.value as ReleaseFileKind)} options={KINDS} hint={kind === "installer" ? "A new installer replaces the current one." : undefined} />
        </div>

        {source === "upload" ? (
          <div className="mt-4 space-y-3">
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
              className={cn("relative grid place-items-center rounded-2xl border-2 border-dashed px-6 py-9 text-center transition", drag ? "border-accent-strong bg-accent/15" : "border-ink-200 bg-surface hover:border-ink-400")}>
              <input id="release-file" ref={fileInput} type="file" onChange={(e) => chooseFile(e.target.files?.[0] ?? null)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Choose a file to upload" />
              <UploadCloud className="h-8 w-8 text-ink-500" aria-hidden />
              {file ? (
                <p className="mt-2 text-[15px] font-semibold">{file.name} <span className="font-normal text-muted tabular">({formatBytes(file.size)})</span></p>
              ) : (
                <><p className="mt-2 text-[15px] font-semibold">Drop the file here, or click to choose</p><p className="text-xs text-muted">Up to 2 GB. Installers must be .exe, .msi or .zip.</p></>
              )}
            </div>
            {file && file.size > 100 * 1024 ** 2 && (
              <p role="note" className="flex gap-2.5 rounded-xl bg-warn/12 px-3.5 py-3 text-[13px] text-[#7A4A00]"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span>This file will use <b>{formatBytes(file.size)}</b> of your Firebase storage, and each new version adds the same again. A <b>download link</b> (for example a GitHub release) uses none.</span></p>
            )}
            {progress && (
              <div role="progressbar" aria-valuenow={progress.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
                <div className="h-2.5 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-gradient-to-r from-accent-strong to-accent transition-[width]" style={{ width: `${progress.pct}%` }} /></div>
                <p className="mt-1.5 flex justify-between text-xs text-muted tabular"><span>{progress.pct}%</span><span>{progress.speed > 0 ? `${formatBytes(progress.speed)}/s, about ${Math.max(Math.round(progress.eta), 1)}s left` : "Starting…"}</span></p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="dark" onClick={upload} disabled={!file || progress !== null} loading={progress !== null}><UploadCloud className="h-4 w-4" aria-hidden />Upload file</Button>
              {file && kind === "installer" && <Button variant="secondary" onClick={calcChecksum} loading={hashing}>Work out SHA-256 first</Button>}
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="flex items-center gap-2 text-sm font-bold"><GitBranch className="h-4 w-4 text-ink-600" aria-hidden />Find it on GitHub</p>
              <p className="mt-0.5 text-xs text-muted">Type your repository and pick the installer. No copying links by hand.</p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="min-w-[14rem] flex-1"><TextField label="Repository" placeholder="your-name/malek-pos" autoComplete="off" spellCheck={false} value={gh.repo} onChange={(e) => setGh({ ...gh, repo: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (gh.repo.trim()) void findOnGithub(); } }} /></div>
                <Button variant="secondary" onClick={findOnGithub} disabled={!gh.repo.trim()} loading={gh.busy}><Search className="h-4 w-4" aria-hidden />Find releases</Button>
              </div>
              {gh.result && (
                <div className="mt-4 space-y-3">
                  <p className="text-xs text-muted">{gh.result.private ? <>This repository is <b>private</b>. {gh.result.tokenConfigured ? "Files will be passed on by your server using your GitHub token." : "Add a GITHUB_TOKEN to the server settings, or visitors won't be able to download."}</> : <>This repository is <b>public</b>, so visitors can download straight from GitHub.</>}</p>
                  {gh.result.releases.length === 0 && <p className="rounded-xl bg-paper px-3 py-4 text-center text-sm text-muted">No releases with files found in {gh.result.repo}.</p>}
                  {gh.result.releases.map((r) => (
                    <div key={r.tag} className="overflow-hidden rounded-xl border border-line">
                      <p className="flex items-center gap-2 bg-paper px-3 py-2 text-sm font-semibold">{r.tag}{r.prerelease && <Badge tone="warn">Pre-release</Badge>}<span className="ml-auto text-xs font-normal text-muted">{r.publishedAt ? timeAgo(r.publishedAt) : ""}</span></p>
                      {r.assets.length === 0 ? <p className="px-3 py-2.5 text-xs text-muted">No files attached to this release.</p> : (
                        <ul className="divide-y divide-line">{r.assets.map((a) => (
                          <li key={a.name} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                            <span className="min-w-0 flex-1"><span className="block truncate font-medium">{a.name}</span><span className="text-xs text-muted tabular">{formatBytes(a.sizeBytes)}{a.downloads ? `, ${a.downloads} downloads on GitHub` : ""}</span></span>
                            <Button size="sm" variant="soft" onClick={() => pickAsset(a)}>Use this file</Button>
                          </li>
                        ))}</ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <TextField label="Direct download link" type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://github.com/you/repo/releases/download/v1.4.2/MalekPOS-Setup.exe"
              value={url} onChange={(e) => { setUrl(e.target.value); setProbe(null); }} hint="Must be a secure https:// link that goes straight to the file, not to a web page." />
            <TextField label="File name (optional)" value={linkName} onChange={(e) => setLinkName(e.target.value)} hint="What visitors will save it as. Filled in from the link if you leave it blank." />

            <fieldset>
              <legend className="mb-2 text-sm font-medium">How should visitors get it?</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  ["redirect", ExternalLink, "Send them to the link", "Recommended for big files. The download comes from GitHub's servers, so it uses none of your bandwidth. The address is visible to anyone who looks."],
                  ["proxy", EyeOff, "Hide the link", "Our server passes the file on, so the address never appears. Every download uses your hosting bandwidth, which is costly for large installers."],
                ] as const).map(([id, Icon, title, text]) => (
                  <label key={id} className={cn("flex cursor-pointer gap-3 rounded-2xl border-2 p-3.5 transition", mode === id ? "border-ink-900 bg-ink-900/[0.03]" : "border-line hover:border-ink-300")}>
                    <input type="radio" name="delivery" checked={mode === id} onChange={() => setMode(id)} className="mt-1 accent-[#0C1A3D]" />
                    <span><span className="flex items-center gap-1.5 text-sm font-bold"><Icon className="h-4 w-4" aria-hidden />{title}{id === "redirect" && <Badge tone="ok">Recommended</Badge>}</span><span className="mt-0.5 block text-xs leading-snug text-muted">{text}</span></span>
                  </label>
                ))}
              </div>
              {mode === "proxy" && (probe?.sizeBytes ?? 0) > 50 * 1024 ** 2 && (
                <p role="note" className="mt-2.5 flex gap-2.5 rounded-xl bg-warn/12 px-3.5 py-3 text-[13px] text-[#7A4A00]"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span>This file is <b>{formatBytes(probe!.sizeBytes)}</b>. With the link hidden, <b>every download</b> sends that much through your hosting account. Ten downloads is about {formatBytes(probe!.sizeBytes * 10)}.</span></p>
              )}
            </fieldset>

            {probe && (
              <div role="status" className={cn("flex gap-3 rounded-2xl p-4 text-sm", probe.ok ? "bg-ok/10 text-[#0B6B45]" : "bg-bad/10 text-[#A22B3B]")}>
                {probe.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden /> : <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />}
                <div>
                  <p className="font-semibold">{probe.ok ? "Link works" : `The link answered with HTTP ${probe.status}`}</p>
                  {probe.ok && <p className="mt-0.5 text-[13px]">{probe.fileName || "File"}, {probe.sizeBytes ? formatBytes(probe.sizeBytes) : "size unknown"}, hosted on {probe.host}. {probe.acceptsRanges ? "Supports resuming interrupted downloads." : "Doesn't support resuming downloads."}</p>}
                  {probe.ok && /text\/html/.test(probe.contentType) && <p className="mt-1 text-[13px] font-semibold text-[#8A5200]">This looks like a web page, not a file.</p>}
                </div>
              </div>
            )}

            <details className="rounded-xl bg-ink-100/60 px-4 py-3 text-[13px] text-ink-700">
              <summary className="cursor-pointer font-semibold">Using a GitHub release?</summary>
              <p className="mt-2 leading-relaxed">Open the release, right-click the .exe file and copy the link address. For a <b>private</b> repository, add a <code className="rounded bg-white px-1 font-receipt">GITHUB_TOKEN</code> to the server settings and paste the asset&apos;s API link (<code className="rounded bg-white px-1 font-receipt">https://api.github.com/repos/you/repo/releases/assets/123</code>). The token stays on the server and is never sent to visitors.</p>
            </details>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={checkLink} disabled={!url.trim()} loading={linkBusy === "test"}>Check the link</Button>
              <Button variant="dark" onClick={addLink} disabled={!url.trim() || (probe !== null && !probe.ok)} loading={linkBusy === "add"}><Link2 className="h-4 w-4" aria-hidden />Add link</Button>
            </div>
          </div>
        )}
      </div>

      <section aria-labelledby="publish-h" className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><h3 id="publish-h" className="font-display text-lg font-bold">Publishing</h3><StatusBadge status={release.status} />{release.isLatest && <Badge tone="accent">Latest</Badge>}</div>
          <div className="flex flex-wrap gap-2">
            {release.status !== "published" && <Button variant="primary" onClick={publish} loading={publishing} disabled={!installer}>{release.status === "archived" ? "Republish" : "Publish"}</Button>}
            {release.status === "published" && <Button variant="secondary" onClick={() => setConfirm("archive")}>Archive</Button>}
            <Button variant="ghost" className="text-[#A22B3B]" onClick={() => setConfirm("delete")}>Delete</Button>
          </div>
        </div>
        {release.status !== "published" && (
          <div className="mt-3">
            <CheckboxField label="Make this the latest release" description="It becomes the version offered on the download page." checked={setAsLatest} onChange={(e) => setSetAsLatest(e.target.checked)} />
            {!installer && <p className="mt-2 text-xs text-muted">Add an installer to enable publishing.</p>}
          </div>
        )}
      </section>
    </div>
  );

  const sharingTab = release && <SharePanel release={release} shares={extras.data?.shares ?? []} loading={extras.loading} onChanged={extras.reload} />;

  const statsTab = release && (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {[["All time", dl?.total ?? 0], ["Last 30 days", lastDays(30, todayISO()).reduce((t, d) => t + (dl?.days[d] ?? 0), 0)], ["Last 7 days", lastDays(7, todayISO()).reduce((t, d) => t + (dl?.days[d] ?? 0), 0)]].map(([l, v]) => (
          <div key={l as string} className="rounded-2xl border border-line bg-paper/60 p-4"><p className="text-sm text-muted">{l}</p><p className="font-display text-3xl font-extrabold tabular">{v}</p></div>
        ))}
      </div>
      <div className="rounded-2xl border border-line p-4"><p className="mb-2 text-sm font-semibold">Downloads per day, last 30 days</p><MonthBars data={lastDays(30, todayISO()).map((d) => ({ label: d.slice(8), value: dl?.days[d] ?? 0 }))} height={170} color="#FFC72C" /></div>
      <p className="text-xs text-muted">A download counts once even if the customer&apos;s browser fetches it in several parts or resumes it.</p>
    </div>
  );

  return (
    <Modal open onClose={onClose} title={release ? `Release v${release.version}` : "New release"} description={release ? release.title : "Start with the details, then add the installer."} size="lg">
      {release ? (
        <Tabs tabs={[
          { id: "files", label: "Files and publishing", count: release.files.length, content: filesTab },
          { id: "details", label: "Details", content: details },
          { id: "share", label: "Private links", count: extras.data?.shares.filter((s) => !s.revoked).length, content: sharingTab },
          { id: "stats", label: "Downloads", content: statsTab },
        ]} />
      ) : details}

      <ConfirmDialog open={confirm === "archive"} title="Archive release" confirmLabel="Archive" description="It disappears from the public download and release pages. Files stay in storage." onClose={() => setConfirm(null)}
        details={release ? [{ label: "Version", value: `v${release.version}` }] : []}
        onConfirm={async () => { if (!release) return; try { await archiveRelease(actor, release); toast.success("Release archived."); setConfirm(null); await refresh(release.id); } catch (err) { toast.error(errorMessage(err)); } }} />
      <ConfirmDialog open={confirm === "delete"} title="Delete release" confirmLabel="Delete permanently" requireText={release ? `v${release.version}` : undefined}
        description={release?.status === "published" ? "This release is live. Deleting it removes it from the site and permanently deletes its uploaded files, private links and download counts." : "This permanently deletes the release, its uploaded files, private links and download counts."} onClose={() => setConfirm(null)}
        onConfirm={async () => { if (!release) return; try { await deleteRelease(actor, release); toast.success("Release deleted."); onChanged(); onClose(); } catch (err) { toast.error(errorMessage(err)); } }} />
    </Modal>
  );
}

// ── Private share links ──────────────────────────────────────────────────────────────────────

const TTLS = [{ value: "1", label: "1 hour" }, { value: "24", label: "24 hours" }, { value: "72", label: "3 days" }, { value: "168", label: "7 days" }, { value: "720", label: "30 days" }];

function shareState(s: ShareLink): { label: string; tone: "ok" | "bad" | "warn" | "neutral" } {
  if (s.revoked) return { label: "Cancelled", tone: "neutral" };
  if (s.expiresAt && Date.parse(s.expiresAt) < Date.now()) return { label: "Expired", tone: "warn" };
  if (s.uses >= s.maxUses) return { label: "Used up", tone: "warn" };
  return { label: "Active", tone: "ok" };
}

function SharePanel({ release, shares, loading, onChanged }: { release: Release; shares: ShareLink[]; loading: boolean; onChanged: () => void }) {
  const toast = useToast();
  const [fileId, setFileId] = useState(release.files.find((f) => f.kind === "installer")?.id ?? release.files[0]?.id ?? "");
  const [ttl, setTtl] = useState("24");
  const [maxUses, setMaxUses] = useState("3");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ url: string; expiresAt: string } | null>(null);
  const [revoking, setRevoking] = useState<ShareLink | null>(null);
  const name = (id: string) => release.files.find((f) => f.id === id)?.name ?? "Removed file";

  if (release.files.length === 0) return <p className="rounded-2xl bg-paper px-4 py-8 text-center text-sm text-muted">Add a file first, then you can make private links for it.</p>;

  return (
    <div className="space-y-6">
      <div className="flex gap-3 rounded-2xl bg-info/10 p-4 text-[13px] text-[#2A4FB0]">
        <Share2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <p><b>Send one customer a private link.</b> It works for a limited time and a limited number of downloads, works even while the release is still a draft, and you can cancel it at any time.</p>
      </div>

      <div className="grid gap-4 rounded-2xl border border-line bg-paper/60 p-4 sm:grid-cols-2 sm:p-5">
        <SelectField label="File" value={fileId} onChange={(e) => setFileId(e.target.value)} options={release.files.map((f) => ({ value: f.id, label: f.name }))} />
        <SelectField label="Works for" value={ttl} onChange={(e) => setTtl(e.target.value)} options={TTLS} />
        <TextField label="Most downloads" inputMode="numeric" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} hint="Then the link stops working." />
        <TextField label="Who is it for? (optional)" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Van Wyk Building Supplies" maxLength={80} />
        <div className="sm:col-span-2">
          <Button variant="dark" loading={busy} disabled={!fileId}
            onClick={async () => {
              const n = Number(maxUses);
              if (!Number.isInteger(n) || n < 1 || n > 1000) return toast.error("Enter a number of downloads between 1 and 1000.");
              setBusy(true);
              try { const r = await createShareLink({ releaseId: release.id, fileId, ttlHours: Number(ttl), maxUses: n, label }); setCreated({ url: r.url, expiresAt: r.expiresAt }); setLabel(""); onChanged(); }
              catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
            }}><Share2 className="h-4 w-4" aria-hidden />Create private link</Button>
        </div>
      </div>

      {created && (
        <div className="rounded-2xl border-2 border-accent-strong/50 bg-accent/15 p-4" role="status">
          <p className="text-sm font-bold">Copy this link now. For safety it can&apos;t be shown again.</p>
          <p className="mt-2 break-all rounded-xl bg-ink-900 p-3 font-receipt text-[12.5px] text-accent">{created.url}</p>
          <div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs text-ink-700">Expires {formatDateTime(created.expiresAt)}</span><CopyButton value={created.url} label="Copy link" /></div>
        </div>
      )}

      <div>
        <h3 className="mb-2 font-display text-lg font-bold">Links you&apos;ve made</h3>
        {loading && shares.length === 0 ? <p className="text-sm text-muted">Loading…</p> : shares.length === 0 ? <p className="rounded-2xl bg-paper px-4 py-6 text-center text-sm text-muted">No private links yet.</p> : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {[...shares].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")).map((s) => {
              const st = shareState(s);
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{s.label || "Untitled link"}</span><span className="block truncate text-xs text-muted">{name(s.fileId)}</span></span>
                  <span className="text-xs text-muted tabular"><Clock className="mr-1 inline h-3 w-3" aria-hidden />{s.expiresAt && Date.parse(s.expiresAt) < Date.now() ? `expired ${timeAgo(s.expiresAt)}` : s.expiresAt ? `until ${formatDateTime(s.expiresAt)}` : "no expiry"}</span>
                  <span className="text-xs font-medium tabular">{s.uses}/{s.maxUses} used</span>
                  <Badge tone={st.tone}>{st.label}</Badge>
                  {st.label === "Active" && <Button size="sm" variant="ghost" className="text-[#A22B3B]" onClick={() => setRevoking(s)}>Cancel</Button>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog open={Boolean(revoking)} title="Cancel this link?" confirmLabel="Cancel link" description="Anyone who has it will get an error instead of the file. This can't be undone, but you can make a new link."
        details={revoking ? [{ label: "For", value: revoking.label || "Untitled link" }, { label: "Used", value: `${revoking.uses} of ${revoking.maxUses}` }] : []} onClose={() => setRevoking(null)}
        onConfirm={async () => { if (!revoking) return; try { await revokeShareLink(revoking.id); toast.success("Link cancelled."); setRevoking(null); onChanged(); } catch (err) { toast.error(errorMessage(err)); } }} />
    </div>
  );
}


