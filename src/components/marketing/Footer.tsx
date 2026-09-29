import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Barcode } from "./Barcode";

const columns = [
  { title: "Product", links: [["Features", "/features"], ["Pricing", "/pricing"], ["Releases", "/releases"], ["Download", "/download"]] },
  { title: "Company", links: [["About", "/about"], ["Contact", "/contact"], ["Support", "/support"]] },
  { title: "Legal", links: [["Terms", "/terms"], ["Privacy", "/privacy"]] },
] as const;

export function Footer({ supportEmail }: { supportEmail?: string }) {
  return (
    <footer className="relative overflow-hidden bg-ink-950 text-ink-300">
      <div aria-hidden className="bg-dots pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-10 pt-16 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div>
          <Logo tone="light" />
          <p className="mt-5 max-w-xs text-[15px] leading-relaxed">Point of sale that runs on your own server, built for shops that can&apos;t afford a slow till.</p>
          {supportEmail && <a href={`mailto:${supportEmail}`} className="mt-5 inline-block rounded-full border border-white/15 px-4 py-2 text-sm text-white transition hover:bg-white/10">{supportEmail}</a>}
        </div>
        {columns.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="mb-4 font-display text-sm font-bold text-white">{c.title}</h2>
            <ul className="space-y-2.5 text-sm">
              {c.links.map(([label, href]) => <li key={href}><Link href={href} className="transition hover:text-white">{label}</Link></li>)}
            </ul>
          </nav>
        ))}
      </div>
      <div className="relative mx-auto max-w-6xl px-5 pb-8">
        <div className="mb-6 h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
          <p>© {new Date().getFullYear()} Malek Enterprise POS. All prices in South African rand (ZAR).</p>
          <Barcode value="MALEKENTERPRISEPOS" height={22} className="w-40 text-white/30" />
        </div>
      </div>
    </footer>
  );
}
