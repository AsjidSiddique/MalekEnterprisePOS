/** Helpers for the "Find it on GitHub" picker in the release editor. Pure, so they're easy to test. */

export interface GithubAsset { name: string; sizeBytes: number; downloads: number; contentType: string; /** Public link. Works for public repositories. */ url: string; /** API link. Needs a server-side token; works for private repositories. */ apiUrl: string }
export interface GithubRelease { tag: string; name: string; publishedAt: string | null; prerelease: boolean; assets: GithubAsset[] }

const REPO = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;

/** Accepts "owner/repo", "github.com/owner/repo" or a full github.com URL (with any path after the repo). */
export function parseGithubRepo(input: string): string | null {
  const text = input.trim().replace(/\.git$/i, "");
  const fromUrl = text.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s?#]+)/i);
  const candidate = fromUrl ? `${fromUrl[1]}/${fromUrl[2]}` : text;
  return REPO.test(candidate) && !candidate.includes("..") ? candidate : null;
}

const INSTALLABLE = /\.(exe|msi|zip|pdf|txt|sha256|sha256sum)$/i;

/** Turns GitHub's release JSON into what the picker needs. Skips drafts and anything that isn't an object. */
export function mapGithubReleases(json: unknown, limit = 8): GithubRelease[] {
  const list = Array.isArray(json) ? json : json && typeof json === "object" ? [json] : [];
  const out: GithubRelease[] = [];
  for (const r of list) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (o.draft === true) continue;
    const assets = (Array.isArray(o.assets) ? o.assets : []).flatMap((a): GithubAsset[] => {
      if (!a || typeof a !== "object") return [];
      const x = a as Record<string, unknown>;
      const name = typeof x.name === "string" ? x.name : "";
      const url = typeof x.browser_download_url === "string" ? x.browser_download_url : "";
      const apiUrl = typeof x.url === "string" ? x.url : "";
      if (!name || !url || !INSTALLABLE.test(name)) return [];
      return [{ name, url, apiUrl, sizeBytes: Number(x.size) || 0, downloads: Number(x.download_count) || 0, contentType: typeof x.content_type === "string" ? x.content_type : "" }];
    });
    out.push({ tag: String(o.tag_name ?? ""), name: String(o.name || o.tag_name || ""), publishedAt: typeof o.published_at === "string" ? o.published_at : null, prerelease: o.prerelease === true, assets });
    if (out.length >= limit) break;
  }
  return out.filter((r) => r.tag);
}
