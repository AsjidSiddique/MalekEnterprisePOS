import { BarChart3, ClipboardCheck, Cloud, Database, KeyRound, MonitorSmartphone, Percent, Printer, ScanLine, ServerCog, WifiOff, Boxes, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { PageBand } from "@/components/marketing/PageBand";
import { Reveal } from "@/components/marketing/Reveal";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Features",
  description: "Sales, stock, goods received vouchers, price maintenance, reports and multi-till support in Malek Enterprise POS.",
};

interface Item { icon: LucideIcon; title: string; text: string }
const sections: { title: string; lede: string; items: Item[] }[] = [
  { title: "Selling", lede: "The till screen is what your staff use all day, so it stays quick and predictable.",
    items: [
      { icon: ScanLine, title: "Scan, search or key in", text: "Take cash or card on the same screen, without waiting on a web page." },
      { icon: Printer, title: "Printed slips", text: "Standard thermal receipt printers that install as a Windows printer." },
      { icon: MonitorSmartphone, title: "Several tills at once", text: "Everyone trades from the same live stock and prices." },
      { icon: Database, title: "Local, not in a browser", text: "A desktop app on your local network, so it doesn't stall on a slow line." },
    ] },
  { title: "Receiving stock", lede: "Deliveries change your cost prices. Capturing them properly keeps margins honest.",
    items: [
      { icon: ClipboardCheck, title: "Goods received vouchers", text: "Book deliveries in against purchase orders and update stock in one step." },
      { icon: Percent, title: "Markup or gross profit", text: "Set selling prices by either, and see the margin while you edit." },
      { icon: Boxes, title: "Stock control", text: "See what's on the shelf across every till without counting twice." },
      { icon: BarChart3, title: "Cost tracking", text: "Cost prices follow your deliveries, so reports reflect what you actually paid." },
    ] },
  { title: "Reporting", lede: "Reports read from the database in your shop, so they're quick and they're yours.",
    items: [
      { icon: BarChart3, title: "Sales and stock reports", text: "Live figures, straight from your own server." },
      { icon: Percent, title: "Margin reporting", text: "Follows your price maintenance, so profit figures stay consistent." },
      { icon: Cloud, title: "Nothing leaves the shop", text: "No sales data is sent to us or to any cloud service." },
    ] },
  { title: "Running it", lede: "Built so that a slow internet line is an annoyance, not an outage.",
    items: [
      { icon: ServerCog, title: "One shop server", text: "A local PostgreSQL database that every till connects to." },
      { icon: WifiOff, title: "Offline allowance", text: "Tills keep trading through outages, for 7 days by default." },
      { icon: KeyRound, title: "Signed licence checks", text: "Checked online about once a day, with signed replies the POS can verify." },
      { icon: MonitorSmartphone, title: "Tills count against your licence", text: "Register a till once; unlink it remotely if it's retired or stolen." },
    ] },
];

export default function FeaturesPage() {
  return (
    <>
      <PageBand title="Built around how a shop actually runs." lede="From the first scan at the till to the delivery that arrives on Friday afternoon." />
      <div className="bg-paper py-8">
        <div className="mx-auto max-w-6xl space-y-6 px-5">
          {sections.map((s, si) => (
            <Reveal key={s.title}>
              <section className="grid gap-8 rounded-xl3 bg-surface p-7 shadow-card ring-1 ring-line md:grid-cols-[0.7fr_1.3fr] md:p-10">
                <div>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-accent font-display text-sm font-extrabold text-accent-ink">{si + 1}</span>
                  <h2 className="display-wide mt-4 text-3xl font-bold sm:text-4xl">{s.title}</h2>
                  <p className="mt-3 max-w-xs text-muted">{s.lede}</p>
                </div>
                <ul className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
                  {s.items.map(({ icon: Icon, title, text }) => (
                    <li key={title} className="flex gap-4">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ink-900 text-accent"><Icon className="h-5 w-5" aria-hidden /></span>
                      <div><h3 className="text-[17px] font-bold">{title}</h3><p className="mt-1 text-[15px] leading-relaxed text-muted">{text}</p></div>
                    </li>
                  ))}
                </ul>
              </section>
            </Reveal>
          ))}
        </div>
      </div>
      <section className="bg-paper pb-20 pt-6">
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex flex-wrap items-center justify-between gap-6 rounded-xl3 bg-ink-900 px-8 py-10 text-white sm:px-12">
            <h2 className="display-wide text-3xl font-bold">Missing something you need?</h2>
            <div className="flex gap-3"><ButtonLink href="/contact" size="lg">Tell us</ButtonLink><ButtonLink href="/pricing" variant="onDark" size="lg">See pricing</ButtonLink></div>
          </div>
        </div>
      </section>
    </>
  );
}
