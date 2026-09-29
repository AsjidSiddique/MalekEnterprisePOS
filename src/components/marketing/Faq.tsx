import { Plus } from "lucide-react";

export interface FaqItem { q: string; a: string }

/** Native <details> so it works without JavaScript and is keyboard-accessible by default. */
export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y divide-line rounded-xl3 bg-surface ring-1 ring-line shadow-card">
      {items.map((it) => (
        <details key={it.q} className="group px-5 py-1 sm:px-7">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left font-display text-[17px] font-bold text-ink-900 marker:hidden [&::-webkit-details-marker]:hidden">
            {it.q}
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink-100 text-ink-700 transition group-open:rotate-45 group-open:bg-accent group-open:text-accent-ink"><Plus className="h-4 w-4" aria-hidden /></span>
          </summary>
          <p className="max-w-2xl pb-6 text-[15px] leading-relaxed text-muted">{it.a}</p>
        </details>
      ))}
    </div>
  );
}
