import { Check, Tag } from "lucide-react";
import type { Metadata } from "next";
import { PageBand } from "@/components/marketing/PageBand";
import { PriceCalculator } from "@/components/marketing/PriceCalculator";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { fetchPricing } from "@/lib/firebase/publicRest";
import { cn } from "@/lib/utils";

export const revalidate = 60;
export const metadata: Metadata = { title: "Pricing", description: "Simple per-till pricing for Malek Enterprise POS, in South African rand." };

export default async function PricingPage() {
  const pricing = await fetchPricing();
  const plans = pricing?.plans ?? [];

  return (
    <>
      <PageBand title={pricing?.headline || "Pay per till, month to month."} lede={pricing?.subtitle || "One licence covers the shop server and every till you register against it."} />
      <div className="bg-paper py-16">
        <div className="mx-auto max-w-6xl px-5">
          {plans.length === 0 ? (
            <div className="panel rounded-xl3">
              <EmptyState icon={Tag} title="Pricing is being finalised" description="We haven't published plans yet. Get in touch and we'll quote for your shop." action={<ButtonLink href="/contact" variant="dark">Ask for a quote</ButtonLink>} />
            </div>
          ) : (
            <div className="space-y-14">
              <div className={cn("grid items-stretch gap-6", plans.length === 1 ? "max-w-md" : plans.length === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3")}>
                {plans.map((p) => (
                  <article key={p.id} className={cn("ticket-notch relative flex flex-col rounded-xl3 shadow-lift", p.highlighted ? "bg-accent text-accent-ink md:-mt-3 md:pb-3" : "bg-surface")} style={{ ["--notch-y" as string]: "58%" }}>
                    <div className="px-8 pb-6 pt-8">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="display-wide text-2xl font-bold">{p.name}</h2>
                        {p.highlighted && <span className="rounded-full bg-ink-900 px-3 py-1 text-xs font-bold text-accent">Most chosen</span>}
                      </div>
                      {p.description && <p className={cn("mt-2 text-[15px]", p.highlighted ? "text-ink-800" : "text-muted")}>{p.description}</p>}
                      <p className="mt-6 flex items-baseline gap-1.5">
                        <span className="font-display text-2xl font-bold">R</span>
                        <span className="display text-[76px] tabular">{Math.round(p.pricePerTerminal)}</span>
                      </p>
                      <p className={cn("text-sm", p.highlighted ? "text-ink-800" : "text-muted")}>per till, per month{p.minTerminals > 1 ? `, from ${p.minTerminals} tills` : ""}</p>
                    </div>
                    <div className="perforation mx-6" aria-hidden />
                    <div className="flex flex-1 flex-col px-8 pb-8 pt-6">
                      <ul className="flex-1 space-y-3 text-[15px]">
                        {p.features.map((f) => (
                          <li key={f} className="flex gap-3"><span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full", p.highlighted ? "bg-ink-900 text-accent" : "bg-ok/15 text-ok")}><Check className="h-3 w-3" aria-hidden /></span>{f}</li>
                        ))}
                      </ul>
                      <ButtonLink href="/contact" variant={p.highlighted ? "dark" : "secondary"} size="lg" className="mt-8 w-full">Get started</ButtonLink>
                    </div>
                  </article>
                ))}
              </div>
              <PriceCalculator plans={plans} />
              <p className="text-center text-sm text-muted">Prices are in South African rand. VAT is shown on your invoice. Running several shops? <a href="/contact" className="font-semibold text-ink-900 underline decoration-accent decoration-2 underline-offset-4">Talk to us</a> about a tailored price.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
