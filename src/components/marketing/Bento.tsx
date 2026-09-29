"use client";

import { useReducedMotion } from "framer-motion";
import { Check, ClipboardCheck, PackageCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { cn, formatZAR, round2 } from "@/lib/utils";

const COST = 84;

/** Price maintenance: drag markup or gross profit and watch the other one, and the price, follow. */
export function PriceLab() {
  const [mode, setMode] = useState<"markup" | "gp">("markup");
  const [value, setValue] = useState(35);
  const markup = mode === "markup" ? value : (value / (100 - value)) * 100;
  const gp = mode === "gp" ? value : (value / (100 + value)) * 100;
  const sell = round2(COST * (1 + markup / 100));
  const profit = round2(sell - COST);
  const max = mode === "markup" ? 120 : 55;

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-xl3 bg-ink-900 p-6 text-white shadow-lift sm:p-8">
      <div aria-hidden className="bg-dots absolute inset-0 opacity-60" />
      <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
      <div className="relative">
        <h3 className="display-wide text-2xl font-bold sm:text-[28px]">Set the price by margin, not by guesswork.</h3>
        <p className="mt-2 max-w-md text-[15px] text-ink-200">Type a markup or a gross profit percentage in price maintenance. The other one and the selling price update as you go.</p>
      </div>

      <div className="relative mt-6 grid gap-5 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 sm:grid-cols-[1fr_auto] sm:p-5">
        <div>
          <div role="tablist" aria-label="Price by" className="mb-4 inline-flex rounded-lg bg-black/25 p-0.5 text-xs font-semibold">
            {(["markup", "gp"] as const).map((m) => (
              <button key={m} role="tab" type="button" aria-selected={mode === m} onClick={() => { setMode(m); setValue(m === "markup" ? 35 : 26); }}
                className={cn("rounded-md px-3 py-1.5 transition", mode === m ? "bg-accent text-accent-ink" : "text-ink-200 hover:text-white")}>{m === "markup" ? "Markup %" : "Gross profit %"}</button>
            ))}
          </div>
          <div className="flex items-baseline justify-between text-sm">
            <label htmlFor="price-lab" className="text-ink-200">{mode === "markup" ? "Markup" : "Gross profit"}</label>
            <span className="font-display text-3xl font-extrabold tabular">{Math.round(value)}%</span>
          </div>
          <input id="price-lab" type="range" min={5} max={max} step={1} value={value} onChange={(e) => setValue(Number(e.target.value))}
            className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-[#FFC72C]" />
          <div className="mt-2 flex justify-between text-[11px] text-ink-400"><span>5%</span><span>{max}%</span></div>
        </div>
        <dl className="grid min-w-[180px] grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-1">
          <div><dt className="text-ink-300">Cost price</dt><dd className="tabular font-semibold">{formatZAR(COST)}</dd></div>
          <div><dt className="text-ink-300">{mode === "markup" ? "Gross profit" : "Markup"}</dt><dd className="tabular font-semibold">{(mode === "markup" ? gp : markup).toFixed(1)}%</dd></div>
          <div><dt className="text-ink-300">Profit per item</dt><dd className="tabular font-semibold text-live">{formatZAR(profit)}</dd></div>
          <div className="col-span-2 rounded-lg bg-accent px-3 py-2 text-accent-ink sm:col-span-1"><dt className="text-[11px] font-semibold">Selling price</dt><dd className="font-display text-2xl font-extrabold tabular">{formatZAR(sell)}</dd></div>
        </dl>
      </div>
    </div>
  );
}

const TILLS = ["Front till", "Back office", "Till 3"];

/** Every till talks to one server. */
export function TillLink() {
  const reduce = useReducedMotion();
  return (
    <div className="flex h-full flex-col rounded-xl3 bg-surface p-6 shadow-card ring-1 ring-line sm:p-7">
      <h3 className="display-wide text-xl font-bold">Add tills as the shop grows.</h3>
      <p className="mt-1.5 text-sm text-muted">Every till works from the same live stock and prices on one shop server.</p>
      <svg viewBox="0 0 320 170" className="mt-4 h-auto w-full" role="img" aria-label="Three tills connected to one shop server">
        {TILLS.map((t, i) => {
          const y = 14 + i * 50;
          const path = `M104 ${y + 17} C 150 ${y + 17}, 150 85, 196 85`;
          return (
            <g key={t}>
              <rect x="6" y={y} width="98" height="34" rx="9" className="fill-ink-100" />
              <circle cx="20" cy={y + 17} r="3.5" className="fill-live" />
              <text x="30" y={y + 21} className="fill-ink-800 text-[11px] font-semibold">{t}</text>
              <path d={path} className="fill-none stroke-ink-300" strokeWidth="1.5" strokeDasharray="3 4" />
              {!reduce && <circle r="3" className="fill-accent-strong"><animateMotion dur={`${2.2 + i * 0.5}s`} begin={`${i * 0.4}s`} repeatCount="indefinite" path={path} /></circle>}
            </g>
          );
        })}
        <rect x="196" y="56" width="118" height="58" rx="12" className="fill-ink-900" />
        <text x="255" y="82" textAnchor="middle" className="fill-white text-[12px] font-bold">Shop server</text>
        <text x="255" y="99" textAnchor="middle" className="fill-ink-300 text-[9.5px]">PostgreSQL</text>
      </svg>
    </div>
  );
}

/** Goods received vouchers. */
export function GrvCard() {
  const rows = [["GRV-0142", "Bakery supplier", "12 lines", true], ["GRV-0141", "Hardware wholesaler", "38 lines", true], ["GRV-0140", "Beverage depot", "9 lines", false]] as const;
  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-xl3 bg-accent p-6 text-accent-ink shadow-lift sm:p-7">
      <div aria-hidden className="absolute -right-8 -top-8 h-32 w-32 rounded-full border-[18px] border-white/25" />
      <ClipboardCheck className="relative h-6 w-6" aria-hidden />
      <h3 className="display-wide relative mt-3 text-xl font-bold">Deliveries update stock and cost in one step.</h3>
      <ul className="relative mt-4 space-y-2">
        {rows.map(([n, s, l, done]) => (
          <li key={n} className="flex items-center gap-3 rounded-xl bg-white/55 px-3 py-2 text-[13px] backdrop-blur-sm">
            <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full", done ? "bg-ink-900 text-accent" : "border-2 border-dashed border-ink-900/40")}>{done && <Check className="h-3.5 w-3.5" aria-hidden />}</span>
            <span className="font-receipt text-[12px] font-semibold">{n}</span>
            <span className="min-w-0 flex-1 truncate text-ink-800">{s}</span>
            <span className="text-ink-700">{l}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Stock at a glance. */
export function StockCard() {
  const rows = [["Brown bread 700g", 82, false], ["Full-cream milk 2L", 46, false], ["AA batteries 4pk", 14, true], ["Paint brush 50mm", 63, false]] as const;
  return (
    <div className="flex h-full flex-col rounded-xl3 bg-surface p-6 shadow-card ring-1 ring-line sm:p-7">
      <PackageCheck className="h-6 w-6 text-ink-700" aria-hidden />
      <h3 className="display-wide mt-3 text-xl font-bold">Know what&apos;s on the shelf.</h3>
      <ul className="mt-4 space-y-3">
        {rows.map(([n, pct, low]) => (
          <li key={n}>
            <div className="mb-1 flex items-center justify-between text-[12.5px]"><span className="text-ink-800">{n}</span>{low ? <span className="inline-flex items-center gap-1 font-semibold text-signal"><TriangleAlert className="h-3 w-3" aria-hidden />Reorder</span> : <span className="tabular text-muted">{pct}%</span>}</div>
            <div className="h-2 overflow-hidden rounded-full bg-ink-100"><div className={cn("h-full rounded-full", low ? "bg-signal" : "bg-ink-700")} style={{ width: `${pct}%` }} /></div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Reports. */
export function ReportCard() {
  const pts = [22, 30, 26, 38, 34, 46, 44, 58];
  const w = 240, h = 84;
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * w, h - (v / 64) * h] as const);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <div className="flex h-full flex-col rounded-xl3 bg-ink-800 p-6 text-white shadow-lift sm:p-7">
      <h3 className="display-wide text-xl font-bold">Reports from your own database.</h3>
      <p className="mt-1.5 text-sm text-ink-200">Sales, stock and margin, fast, because nothing leaves your network.</p>
      <svg viewBox={`0 0 ${w} ${h + 6}`} className="mt-5 h-auto w-full" role="img" aria-label="Sales trend rising">
        <defs><linearGradient id="rep-g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#FFC72C" stopOpacity="0.4" /><stop offset="1" stopColor="#FFC72C" stopOpacity="0" /></linearGradient></defs>
        <path d={`${line} L${w} ${h} L0 ${h} Z`} fill="url(#rep-g)" />
        <path d={line} fill="none" stroke="#FFC72C" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={xy.at(-1)![0]} cy={xy.at(-1)![1]} r="4" fill="#FFC72C" />
      </svg>
      <p className="mt-auto pt-3 text-[11px] text-ink-400">Example data</p>
    </div>
  );
}
