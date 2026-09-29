import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { cn } from "@/lib/utils";

interface Props { label: string; value: string | number; hint?: string; icon: LucideIcon; tone?: "default" | "warn" | "bad"; href?: string; spark?: number[] }

function Spark({ values, tone }: { values: number[]; tone: string }) {
  const w = 96, h = 32;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => [(i / Math.max(values.length - 1, 1)) * w, h - 3 - (v / max) * (h - 8)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-24" aria-hidden>
      <path d={`${line} L${w} ${h} L0 ${h} Z`} className={tone} fillOpacity="0.12" />
      <path d={line} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn(tone, "fill-none")} stroke="currentColor" />
    </svg>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = "default", href, spark }: Props) {
  const accent = tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-ink-700";
  const body = (
    <div className={cn("group relative h-full overflow-hidden rounded-xl2 border border-line bg-surface p-5 shadow-card transition duration-200", href && "hover:-translate-y-0.5 hover:shadow-lift")}>
      <div className="flex items-start justify-between">
        <span className={cn("grid h-10 w-10 place-items-center rounded-xl", tone === "bad" ? "bg-bad/10 text-bad" : tone === "warn" ? "bg-warn/15 text-warn" : "bg-ink-900 text-accent")}><Icon className="h-[18px] w-[18px]" aria-hidden /></span>
        {spark && <span className={accent}><Spark values={spark} tone={tone === "bad" ? "fill-bad" : tone === "warn" ? "fill-warn" : "fill-ink-700"} /></span>}
      </div>
      <p className="mt-5 font-display text-[34px] font-extrabold leading-none tabular text-ink-900">{typeof value === "number" ? <AnimatedNumber value={value} /> : value}</p>
      <p className="mt-1.5 text-sm font-medium text-ink-700">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}
