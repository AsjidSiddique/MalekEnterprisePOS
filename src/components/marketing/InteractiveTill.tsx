"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BatteryCharging, Cable, Coffee, Croissant, Droplets, Milk, Paintbrush, Plug, RotateCcw, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn, formatZAR, round2 } from "@/lib/utils";
import { Barcode } from "./Barcode";

interface Product { id: string; name: string; price: number; icon: LucideIcon }

const PRODUCTS: Product[] = [
  { id: "bread", name: "Brown bread 700g", price: 18.99, icon: Croissant },
  { id: "milk", name: "Full-cream milk 2L", price: 42.5, icon: Milk },
  { id: "batt", name: "AA batteries 4pk", price: 39.95, icon: BatteryCharging },
  { id: "cord", name: "Extension cord 5m", price: 129, icon: Plug },
  { id: "ties", name: "Cable ties 100pk", price: 24.5, icon: Cable },
  { id: "soap", name: "Dish soap 750ml", price: 21.99, icon: Droplets },
  { id: "coffee", name: "Instant coffee 250g", price: 64.9, icon: Coffee },
  { id: "brush", name: "Paint brush 50mm", price: 32, icon: Paintbrush },
];

const money = (n: number) => formatZAR(n).replace("R ", "");
type Phase = "selling" | "printing" | "done";

/**
 * The hero: a till you can actually use. Tap products, watch the basket and VAT update, pay, and the slip prints.
 * Prices include 15% VAT, as on a real South African till slip.
 */
export function InteractiveTill() {
  const reduce = useReducedMotion();
  const [basket, setBasket] = useState<Record<string, number>>({});
  const [phase, setPhase] = useState<Phase>("selling");
  const [method, setMethod] = useState<"Card" | "Cash">("Card");
  const [flash, setFlash] = useState<string | null>(null);
  const [saleNo, setSaleNo] = useState(4127);
  const touched = useRef(false);

  const lines = useMemo(() => PRODUCTS.filter((p) => basket[p.id]).map((p) => ({ ...p, qty: basket[p.id] ?? 0 })), [basket]);
  const total = round2(lines.reduce((t, l) => t + l.qty * l.price, 0));
  const vat = round2((total * 15) / 115);
  const items = lines.reduce((t, l) => t + l.qty, 0);

  const add = (id: string, byUser = true) => {
    if (phase !== "selling") return;
    if (byUser) touched.current = true;
    setBasket((b) => ({ ...b, [id]: (b[id] ?? 0) + 1 }));
    setFlash(id);
    window.setTimeout(() => setFlash((f) => (f === id ? null : f)), 380);
  };

  // A short self-playing demo so the till is never empty on load. It stops the moment someone touches it.
  useEffect(() => {
    const steps: [string, number][] = [["cord", 1300], ["batt", 2300], ["batt", 3100], ["ties", 3900]];
    const timers = steps.map(([id, at]) => window.setTimeout(() => { if (!touched.current) add(id, false); }, at));
    return () => timers.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pay = (m: "Card" | "Cash") => {
    if (items === 0 || phase !== "selling") return;
    touched.current = true;
    setMethod(m);
    setPhase("printing");
    window.setTimeout(() => setPhase("done"), reduce ? 200 : 2600);
  };
  const reset = () => { setBasket({}); setPhase("selling"); setSaleNo((n) => n + 1); };

  return (
    <div className="relative mx-auto w-full max-w-[540px]">
      <div aria-hidden className="absolute -inset-x-10 -top-10 bottom-10 rounded-full bg-accent/10 blur-3xl" />

      {/* Till */}
      <div className="relative rounded-[26px] border border-white/15 bg-gradient-to-b from-ink-700/90 to-ink-800 p-3 shadow-pop">
        <div className="flex items-center gap-2 px-2 pb-2.5 pt-1 text-[11px] text-ink-200">
          <span className="font-semibold text-white">Till 02</span>
          <span className="text-ink-400">Cashier: Thandi</span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-live/15 px-2 py-0.5 font-medium text-live">
            <span className="relative flex h-1.5 w-1.5"><span className="absolute inset-0 animate-ring rounded-full bg-live" /><span className="relative h-1.5 w-1.5 rounded-full bg-live" /></span>
            Connected to shop server
          </span>
        </div>

        {/* Screen */}
        <div className="rounded-[16px] bg-ink-950 p-3.5 ring-1 ring-white/10">
          <div className="mb-1 flex items-center justify-between px-1 text-[10px] text-ink-400">
            <span>Sale #{saleNo}</span><span>{items} item{items === 1 ? "" : "s"}</span>
          </div>
          <ul className="min-h-[104px] space-y-px" aria-label="Basket">
            <AnimatePresence initial={false}>
              {lines.length === 0 && (
                <motion.li key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid h-[104px] place-items-center text-[13px] text-ink-400">Tap an item to add it</motion.li>
              )}
              {lines.map((l) => (
                <motion.li
                  key={l.id} layout={!reduce} initial={{ opacity: 0, x: -14, backgroundColor: "rgba(255,199,44,0.28)" }} animate={{ opacity: 1, x: 0, backgroundColor: "rgba(255,199,44,0)" }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 rounded-md px-1.5 py-[7px] text-[13px] text-ink-100"
                >
                  <span className="truncate">{l.name}</span>
                  <span className="tabular text-ink-400">×{l.qty}</span>
                  <span className="tabular w-16 text-right">{money(l.qty * l.price)}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <div className="mt-2 flex items-end justify-between border-t border-white/10 px-1 pt-3">
            <span className="pb-1 text-xs text-ink-300">Total<span className="ml-2 text-ink-500">incl. VAT {money(vat)}</span></span>
            <span className="font-display text-[40px] font-extrabold leading-none tabular text-white" aria-live="polite" aria-label={`Total ${formatZAR(total)}`}>
              <span className="mr-1.5 text-xl font-semibold text-accent">R</span>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={total} initial={{ y: reduce ? 0 : -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="inline-block">{money(total)}</motion.span>
              </AnimatePresence>
            </span>
          </div>
        </div>

        {/* Keys */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          {PRODUCTS.map((p, i) => {
            const Icon = p.icon;
            return (
              <button
                key={p.id} type="button" onClick={() => add(p.id)} disabled={phase !== "selling"} aria-label={`Add ${p.name}, ${formatZAR(p.price)}`}
                className={cn(
                  "group relative flex flex-col items-start gap-1 rounded-xl border border-white/10 bg-white/[0.06] p-2.5 text-left transition duration-150 hover:border-accent/60 hover:bg-white/[0.11] active:scale-[0.97] disabled:opacity-50",
                  flash === p.id && "border-accent bg-accent/25",
                )}
              >
                <Icon className="h-4 w-4 text-accent" aria-hidden />
                <span className="line-clamp-2 min-h-[28px] text-[11px] leading-[14px] text-ink-100">{p.name}</span>
                <span className="tabular text-[11px] font-semibold text-white">{money(p.price)}</span>
                {i === 3 && items === 0 && phase === "selling" && <span aria-hidden className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-ring rounded-full bg-accent" />}
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
          <button type="button" onClick={() => pay("Cash")} disabled={items === 0 || phase !== "selling"} className="h-11 rounded-xl bg-white/10 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-40">Cash</button>
          <button type="button" onClick={() => pay("Card")} disabled={items === 0 || phase !== "selling"} className="h-11 rounded-xl bg-accent text-sm font-bold text-accent-ink shadow-btn transition hover:brightness-105 active:translate-y-px disabled:opacity-40 disabled:shadow-none">Pay by card</button>
          <button type="button" onClick={reset} aria-label="Clear the sale" className="grid h-11 w-11 place-items-center rounded-xl border border-white/15 text-ink-200 transition hover:bg-white/10"><RotateCcw className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Printer slot + slip */}
      <div aria-hidden className="relative z-10 mx-8 -mt-px h-3.5 rounded-b-xl bg-ink-950 shadow-[inset_0_-3px_6px_rgb(0_0_0/0.5)]" />
      <div className="relative mx-11 -mt-1 min-h-[150px]">
        <AnimatePresence>
          {phase === "selling" && (
            <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-7 text-center text-[13px] text-ink-300">
              {items === 0 ? "The slip prints here." : "Pay to print the slip."}
            </motion.p>
          )}
        </AnimatePresence>
        {phase !== "selling" && (
          <motion.div initial={{ clipPath: "inset(0 0 100% 0)" }} animate={{ clipPath: "inset(0 0 0% 0)" }} transition={{ duration: reduce ? 0 : 2.4, ease: "linear" }} className="drop-shadow-[0_18px_26px_rgba(4,8,24,0.45)]">
            <div className="receipt-paper px-4 pb-3 pt-4 font-receipt text-[10.5px] leading-[1.65] text-ink-900">
              <p className="text-center font-bold tracking-wide">MALEK ENTERPRISE POS</p>
              <p className="text-center text-ink-600">Till 02 · Sale #{saleNo}</p>
              <div className="my-1.5 border-t border-dashed border-ink-300" />
              {lines.map((l) => (
                <p key={l.id} className="flex justify-between gap-2 whitespace-nowrap"><span className="truncate">{l.qty} × {l.name}</span><span className="tabular">{money(l.qty * l.price)}</span></p>
              ))}
              <div className="my-1.5 border-t border-dashed border-ink-300" />
              <p className="flex justify-between text-ink-600"><span>VAT 15% incl.</span><span className="tabular">{money(vat)}</span></p>
              <p className="flex justify-between text-[12px] font-bold"><span>TOTAL</span><span className="tabular">{money(total)}</span></p>
              <p className="flex justify-between"><span>{method}</span><span className="tabular">{money(total)}</span></p>
              <Barcode value={`MEP${saleNo}${total}`} height={26} className="mt-2 w-full text-ink-900" />
              <p className="mt-1 text-center text-ink-600">Thank you for shopping</p>
            </div>
            <svg viewBox="0 0 240 8" preserveAspectRatio="none" className="block h-2 w-full"><path d={`M0 0 ${Array.from({ length: 20 }, (_, i) => `L${i * 12 + 6} 8 L${(i + 1) * 12} 0`).join(" ")} Z`} fill="#fdfdfb" /></svg>
          </motion.div>
        )}
      </div>
      {phase === "done" && (
        <button type="button" onClick={reset} className="mx-auto mt-3 block rounded-full border border-white/20 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-white/10">Start a new sale</button>
      )}
    </div>
  );
}
