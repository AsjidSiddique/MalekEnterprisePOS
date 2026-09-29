import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@fontsource-variable/bricolage-grotesque/wdth.css";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { PRODUCT_NAME, SITE_URL } from "@/lib/constants";

const description =
  "Malek Enterprise POS is retail point-of-sale software for shops that run on a local server: sales, stock, purchase orders, GRVs, price management and reports across every till.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${PRODUCT_NAME} — Modern Retail Point of Sale Software`, template: `%s | ${PRODUCT_NAME}` },
  description,
  applicationName: PRODUCT_NAME,
  alternates: { canonical: "/" },
  keywords: ["point of sale", "POS software", "retail POS", "South Africa", "stock management", "GRV", "purchase orders", "offline POS", "licence management"],
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  formatDetection: { telephone: false, email: false, address: false },
  // Without this, sharing a link on WhatsApp/Slack/Facebook/Twitter shows plain text only - no
  // preview image. Reuses the existing 512x512 logo mark; swap for a proper 1200x630 banner
  // image later if a dedicated marketing one is made, but this is a real image now instead of none.
  openGraph: { type: "website", locale: "en_ZA", siteName: PRODUCT_NAME, title: `${PRODUCT_NAME} — Modern Retail Point of Sale Software`, description, url: SITE_URL, images: [{ url: "/logo-mark.png", width: 512, height: 512, alt: PRODUCT_NAME }] },
  twitter: { card: "summary_large_image", title: `${PRODUCT_NAME} — Modern Retail Point of Sale Software`, description, images: ["/logo-mark.png"] },
};

export const viewport: Viewport = { themeColor: "#0C1A3D", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
