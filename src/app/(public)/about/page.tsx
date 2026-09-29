import type { Metadata } from "next";
import { PageBand } from "@/components/marketing/PageBand";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "About", description: "Why Malek Enterprise POS keeps its database in your shop." };

const principles = [
  ["Your data stays yours", "Sales live on a server in your shop. Reports are fast, and there's nothing to migrate if you ever change your mind."],
  ["The till comes first", "Tills talk to your local network, not a distant data centre, so a slow internet line never slows a sale."],
  ["Fair and simple pricing", "You pay per till, month to month, in rand. No surprises on the invoice."],
];

export default function AboutPage() {
  return (
    <>
      <PageBand title="Software for shops that need the till to work." />
      <div className="bg-paper py-16">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid gap-10 md:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6 text-[19px] leading-relaxed text-ink-800">
              <p>Malek Enterprise POS started as software for a working retail store, written around what that store needed every day: quick sales, accurate stock, proper goods received vouchers, and prices that hold a healthy margin.</p>
              <p>Most modern point-of-sale products live in someone else&apos;s cloud. That works until the line drops, the till freezes and there&apos;s a queue at the counter. We took the opposite approach: the database runs in your shop, the tills connect to it directly, and the internet is only used for the licence check.</p>
            </div>
            <ul className="space-y-4">
              {principles.map(([t, d], i) => (
                <li key={t} className="rounded-xl3 bg-surface p-6 shadow-card ring-1 ring-line">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-accent font-display text-sm font-extrabold text-accent-ink">{i + 1}</span>
                  <h2 className="mt-3 text-lg font-bold">{t}</h2><p className="mt-1 text-[15px] text-muted">{d}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-12"><ButtonLink href="/contact" variant="dark" size="lg">Get in touch</ButtonLink></div>
        </div>
      </div>
    </>
  );
}
