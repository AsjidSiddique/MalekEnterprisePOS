import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/features", "/pricing", "/download", "/releases", "/about", "/contact"].map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: path === "/releases" || path === "/download" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
