import type { ReactNode } from "react";
import { TearEdge } from "./TearEdge";

/** Page banner: dark, dotted, with a torn-receipt edge into the page below. */
export function PageBand({ title, lede, children }: { title: string; lede?: string; children?: ReactNode }) {
  return (
    <section className="relative bg-ink-900 text-white">
      <div aria-hidden className="bg-dots absolute inset-0" />
      <div aria-hidden className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-16 md:pb-24 md:pt-24">
        <h1 className="display max-w-3xl text-[44px] text-balance sm:text-6xl md:text-7xl">{title}</h1>
        {lede && <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-200">{lede}</p>}
        {children}
      </div>
      <TearEdge className="absolute -bottom-px left-0" />
    </section>
  );
}
