import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const demo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig = {
  // Always define the flag so it is inlined at build time; in production the demo code is then removed entirely.
  env: { NEXT_PUBLIC_DEMO_MODE: demo ? "true" : "false" },
  reactStrictMode: true,
  poweredByHeader: false,
  // BUG FIX: the only <Image> in the whole app (the logo, a small pre-sized 512x512 PNG already
  // shipped in /public) was going through Vercel's Image Optimization pipeline by default. That
  // pipeline has its own separate usage allowance from the rest of Hobby-plan hosting, and once a
  // project runs past it, Vercel starts returning 402 Payment Required for every further
  // optimization request - which is exactly the recurring "Failed to load resource: 402" seen on
  // every page, and why the logo rendered as its own alt text instead of the actual image.
  // There's nothing to optimize here anyway (one small fixed-size asset, not a gallery of
  // variable/user-uploaded images), so this turns optimization off entirely and serves the file
  // as a plain static asset - faster (no per-request transform) and immune to this billing wall.
  images: { unoptimized: true },
  webpack(config) {
    if (demo) {
      const alias = (name, file) => [`${name}$`, path.join(here, "src/lib/demo", file)];
      config.resolve.alias = { ...config.resolve.alias, ...Object.fromEntries([alias("firebase/app", "app.ts"), alias("firebase/auth", "auth.ts"), alias("firebase/firestore", "firestore.ts"), alias("firebase/storage", "storage.ts")]) };
    }
    return config;
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
