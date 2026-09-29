import { ArrowRight, Check, FileWarning, Hourglass, KeyRound, ShieldCheck, TrendingDown, WifiOff, ZapOff } from "lucide-react";
import { Faq } from "@/components/marketing/Faq";
import { GrvCard, PriceLab, ReportCard, StockCard, TillLink } from "@/components/marketing/Bento";
import { InteractiveTill } from "@/components/marketing/InteractiveTill";
import { LeaseTimeline } from "@/components/marketing/LeaseTimeline";
import { NetworkDiagram } from "@/components/marketing/NetworkDiagram";
import { Reveal } from "@/components/marketing/Reveal";
import { Spotlight } from "@/components/marketing/Spotlight";
import { TearEdge } from "@/components/marketing/TearEdge";
import { ButtonLink } from "@/components/ui/Button";
import { fetchLatestRelease } from "@/lib/firebase/publicRest";
import { formatDate } from "@/lib/utils";
import { PRODUCT_NAME, SITE_URL } from "@/lib/constants";

export const revalidate = 60;

const steps = [
  ["Install", "Download the installer. Set up the server on your shop PC, then the POS on each till."],
  ["Activate", "Enter your licence key once. The server registers itself and every till that connects."],
  ["Trade", "Sales run on your local network. A slow or dropped internet line never touches the till."],
  ["Renew", "The server checks in about once a day and keeps an offline allowance for outages."],
];

const problems = [
  {
    icon: Hourglass,
    title: "A customer asks the price of one item, and the queue stops.",
    text: "No dedicated price-check screen means digging through the sales screen just to answer a question that should take two seconds.",
  },
  {
    icon: FileWarning,
    title: "Stock never quite matches what's on the shelf.",
    text: "Goods come in against a paper delivery note, get added by hand later, and small mistakes compound sale after sale.",
  },
  {
    icon: TrendingDown,
    title: "A supplier's price goes up, and nobody notices until margin does.",
    text: "Without a prompt at goods-receiving, a cost increase quietly becomes a loss on every sale until someone spots it in the numbers.",
  },
  {
    icon: ZapOff,
    title: "The internet drops, and the till stops taking sales.",
    text: "Cloud-only POS systems fail exactly when load-shedding or a bad line hits — the moment a shop can least afford to stop trading.",
  },
];

const faq = [
  { q: "Do I need the internet to trade?", a: "No. Sales, stock and prices run on your shop's local network. The server checks your licence online about once a day, and if the line is down it keeps working through an offline allowance (7 days by default)." },
  { q: "Where is my sales data kept?", a: "On a PostgreSQL database on your own server, in your shop. We don't host your sales and we can't see them." },
  { q: "What happens if a payment is late?", a: "You get a reminder before the due date. After it, a grace period (5 days by default) keeps everything working. If the invoice is still unpaid, the licence is suspended, and it comes back as soon as you pay." },
  { q: "How are tills counted?", a: "Each till registers with your licence key and counts towards the terminal limit on your subscription. If a till is retired or stolen, it can be unlinked remotely to free its place." },
  { q: "Can I trust the download?", a: "Every release shows its SHA-256 checksum so you can confirm the file arrived intact. Download links are made when you click and stop working after five minutes." },
];

export default async function HomePage() {
  const latest = await fetchLatestRelease();
  // Structured data so search engines understand this is a software product (eligible for richer results).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: PRODUCT_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Windows",
    url: SITE_URL,
    description: "Retail point-of-sale software that runs on a local shop server: sales, stock, purchase orders, GRVs, price management and reports.",
    ...(latest ? { softwareVersion: latest.version } : {}),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink-900 text-white">
        <div aria-hidden className="bg-dots absolute inset-0" />
        <div aria-hidden className="absolute -left-40 top-20 h-[420px] w-[420px] rounded-full bg-ink-600/40 blur-[120px]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-28 pt-14 md:pt-20 lg:grid-cols-[1.02fr_1fr] lg:pb-32">
          <div>
            {latest && (
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1 pl-1 pr-3.5 text-[13px] text-ink-100">
                <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-ink">v{latest.version}</span>
                Released {formatDate(latest.releaseDate)}
              </p>
            )}
            <h1 className="display text-[54px] text-balance sm:text-7xl xl:text-[88px]">Point of sale that runs on your own server.</h1>
            <p className="mt-7 max-w-lg text-lg leading-relaxed text-ink-200">
              Sales, stock, purchasing and price management for shops with one till or many. Your data stays on your network, and the internet is only needed to check your licence.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="/download" size="lg">Download for Windows</ButtonLink>
              <ButtonLink href="/pricing" size="lg" variant="onDark">See pricing</ButtonLink>
            </div>
            <ul className="mt-9 space-y-2.5 text-[15px] text-ink-100">
              {["Runs on a server in your shop", "Tills keep trading through internet outages", "Pay per till, month to month, in rand"].map((t) => (
                <li key={t} className="flex items-center gap-2.5"><span className="grid h-5 w-5 place-items-center rounded-full bg-live/20 text-live"><Check className="h-3 w-3" aria-hidden /></span>{t}</li>
              ))}
            </ul>
          </div>
          <InteractiveTill />
        </div>
        <TearEdge className="absolute -bottom-px left-0" />
      </section>

      {/* Problem */}
      <section className="bg-surface py-24">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-signal">The way most shops still do this</p>
            <h2 className="display-wide mt-3 max-w-3xl text-[32px] font-bold text-balance sm:text-[40px]">Four ways a busy shop quietly loses money every day.</h2>
          </Reveal>
          <div className="mt-14 grid gap-5 sm:grid-cols-2">
            {problems.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} delay={i * 0.06}>
                <div className="flex h-full gap-4 rounded-xl3 border border-line bg-paper p-6">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-bad/10 text-bad">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-[17px] font-bold leading-snug text-ink-900">{title}</h3>
                    <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.2}>
            <p className="mt-10 text-[17px] font-semibold text-ink-900">This is exactly what Malek Enterprise POS is built to fix — starting with the sale screen below.</p>
          </Reveal>
        </div>
      </section>

      {/* Features */}
      <section className="bg-paper py-24">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <h2 className="display-wide max-w-3xl text-[32px] font-bold text-balance sm:text-[40px]">Everything a busy shop touches in a day, in one place.</h2>
          </Reveal>
          <div className="mt-14 grid gap-4 lg:grid-cols-12">
            <Reveal className="lg:col-span-7"><Spotlight className="h-full rounded-xl3"><PriceLab /></Spotlight></Reveal>
            <Reveal delay={0.06} className="lg:col-span-5"><Spotlight className="h-full rounded-xl3" tone="rgb(12 26 61 / 0.07)"><TillLink /></Spotlight></Reveal>
            <Reveal className="lg:col-span-4"><Spotlight className="h-full rounded-xl3" tone="rgb(255 255 255 / 0.45)"><GrvCard /></Spotlight></Reveal>
            <Reveal delay={0.06} className="lg:col-span-4"><Spotlight className="h-full rounded-xl3" tone="rgb(255 199 44 / 0.14)"><StockCard /></Spotlight></Reveal>
            <Reveal delay={0.12} className="lg:col-span-4"><Spotlight className="h-full rounded-xl3"><ReportCard /></Spotlight></Reveal>
          </div>
          <div className="mt-10"><ButtonLink href="/features" variant="secondary" size="lg">See every feature <ArrowRight className="h-4 w-4" aria-hidden /></ButtonLink></div>
        </div>
      </section>

      {/* Local first */}
      <section className="relative overflow-hidden bg-ink-900 py-24 text-white">
        <div aria-hidden className="bg-dots absolute inset-0 opacity-70" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-[0.85fr_1.15fr]">
          <Reveal>
            <h2 className="display-wide text-[32px] font-bold text-balance sm:text-[40px]">Fast at the till, because the database is in the shop.</h2>
            <p className="mt-6 text-[17px] leading-relaxed text-ink-200">
              Tills talk to one server on your local network, so a sale never waits on a distant data centre. The only thing that goes online is a small licence check.
            </p>
            <ul className="mt-7 space-y-4 text-[15px] text-ink-100">
              <li className="flex gap-3"><WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />Internet down? Trading carries on for the length of the offline allowance.</li>
              <li className="flex gap-3"><KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />Licence keys are checked on our server and never stored in plain text.</li>
              <li className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />Licence answers are digitally signed, so a forged reply is rejected.</li>
            </ul>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="rounded-xl3 bg-white/[0.05] p-5 ring-1 ring-white/10 sm:p-8">
              <NetworkDiagram />
              <div className="mt-8 border-t border-white/10 pt-7"><LeaseTimeline /></div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Steps */}
      <section className="bg-surface py-24">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal><h2 className="display-wide max-w-2xl text-[32px] font-bold text-balance sm:text-[40px]">From download to first sale.</h2></Reveal>
          <ol className="mt-14 grid gap-x-8 gap-y-10 md:grid-cols-4">
            {steps.map(([title, text], i) => (
              <Reveal key={title} delay={i * 0.07}>
                <li className="relative border-t-2 border-ink-900 pt-5">
                  <span className="absolute -top-[13px] left-0 grid h-6 w-6 place-items-center rounded-full bg-accent font-display text-xs font-extrabold text-accent-ink ring-4 ring-surface">{i + 1}</span>
                  <h3 className="text-xl font-bold">{title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted">{text}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-paper py-24">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 lg:grid-cols-[0.6fr_1.4fr]">
          <Reveal>
            <h2 className="display-wide text-[32px] font-bold text-balance sm:text-[40px]">Questions shop owners ask.</h2>
            <p className="mt-5 text-muted">Something else? <a href="/contact" className="font-semibold text-ink-900 underline decoration-accent decoration-2 underline-offset-4">Ask us.</a></p>
          </Reveal>
          <Reveal delay={0.08}><Faq items={faq} /></Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-paper pb-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="ticket-notch relative overflow-hidden rounded-xl3 bg-accent px-8 py-14 text-accent-ink sm:px-14" style={{ ["--notch-y" as string]: "50%" }}>
            <div aria-hidden className="absolute inset-y-0 right-24 hidden w-px border-l-2 border-dashed border-ink-900/25 md:block" />
            <div className="flex flex-wrap items-center justify-between gap-8">
              <div>
                <h2 className="display text-4xl text-balance sm:text-6xl">Ready to see it in your shop?</h2>
                <p className="mt-4 max-w-md text-[17px] text-ink-800">Download the installer today, or tell us about your shop and we&apos;ll help you set up.</p>
              </div>
              <div className="flex flex-wrap gap-3 md:pr-16">
                <ButtonLink href="/download" variant="dark" size="lg">Download</ButtonLink>
                <ButtonLink href="/contact" variant="secondary" size="lg" className="border-ink-900/20 bg-white/60">Talk to us</ButtonLink>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
