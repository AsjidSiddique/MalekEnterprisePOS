import type { ReleaseFile, ReleaseStatus } from "@/types";

export const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const [core = "", pre] = v.replace(/^v/i, "").split("-", 2);
    return { nums: core.split(".").map((n) => Number.parseInt(n, 10) || 0), pre };
  };
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    const d = (pa.nums[i] ?? 0) - (pb.nums[i] ?? 0);
    if (d !== 0) return d;
  }
  if (pa.pre && !pb.pre) return -1; // 1.0.0-beta < 1.0.0
  if (!pa.pre && pb.pre) return 1;
  return (pa.pre ?? "").localeCompare(pb.pre ?? "");
}

export interface PublishCandidate {
  id?: string;
  version: string;
  files: Pick<ReleaseFile, "kind">[];
}

export interface ReleaseSummary {
  id: string;
  version: string;
  status: ReleaseStatus;
}

export function evaluatePublish(candidate: PublishCandidate, others: ReleaseSummary[]): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!candidate.files.some((f) => f.kind === "installer")) errors.push("Upload an installer before publishing.");
  if (!SEMVER_RE.test(candidate.version)) errors.push("Version must look like 1.2.3.");
  const dup = others.find((o) => o.id !== candidate.id && o.version === candidate.version);
  if (dup) errors.push(`Version ${candidate.version} already exists (${dup.status}).`);
  return { ok: errors.length === 0, errors };
}

export function pickLatest<T extends { status: ReleaseStatus; isLatest: boolean; version: string }>(releases: T[]): T | null {
  const published = releases.filter((r) => r.status === "published");
  if (published.length === 0) return null;
  const flagged = published.filter((r) => r.isLatest).sort((a, b) => compareVersions(b.version, a.version));
  if (flagged[0]) return flagged[0];
  return [...published].sort((a, b) => compareVersions(b.version, a.version))[0] ?? null;
}
