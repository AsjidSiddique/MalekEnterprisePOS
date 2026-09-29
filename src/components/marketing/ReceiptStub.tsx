"use client";

import { motion } from "framer-motion";
import { cn, formatZAR, round2 } from "@/lib/utils";

const ITEMS = [
  { name: "AA batteries 4pk", qty: 2, price: 39.95 },
  { name: "Extension cord 5m", qty: 1, price: 129 },
  { name: "Cable ties 100pk", qty: 1, price: 24.5 },
];

const total = round2(ITEMS.reduce((t, i) => t + i.qty * i.price, 0));
const vatIncluded = round2((total * 15) / 115);

function Zigzag() {
  const teeth = 20;
  const d = `M0 0 ${Array.from({ length: teeth }, (_, i) => `L${i * 12 + 6} 8 L${(i + 1) * 12} 0`).join(" ")} Z`;
  return (
    <svg viewBox={`0 0 ${teeth * 12} 8`} preserveAspectRatio="none" className="block h-2 w-full" aria-hidden>
      <path d={d} fill="#fbfcfd" />
    </svg>
  );
}

/** Decorative till slip. With `animate`, the paper feeds out of a printer slot and the lines appear one by one. */
export function ReceiptStub({ className, animate = false }: { className?: string; animate?: boolean }) {
  const rows: { left: string; right?: string; strong?: boolean; gap?: boolean }[] = [
    { left: "MALEK ENTERPRISE POS", strong: true },
    { left: "Till 02   Cashier: Thandi" },
    { left: "------------------------------" },
    ...ITEMS.map((i) => ({ left: `${i.qty} x ${i.name}`, right: formatZAR(i.qty * i.price).replace("R ", "") })),
    { left: "------------------------------" },
    { left: "VAT 15% incl.", right: formatZAR(vatIncluded).replace("R ", "") },
    { left: "TOTAL", right: formatZAR(total).replace("R ", ""), strong: true },
    { left: "Card", right: formatZAR(total).replace("R ", "") },
    { left: "Thank you for shopping", gap: true },
  ];

  const paper = (
    <div className="receipt-paper px-4 pb-3 pt-5 font-receipt text-[11px] leading-[1.7] text-ink-900" aria-hidden>
      {rows.map((r, i) => {
        const line = (
          <div className={cn("flex justify-between gap-3 whitespace-nowrap", r.strong && "font-bold", r.gap && "mt-2 justify-center text-ink-600")}>
            <span className="overflow-hidden text-ellipsis">{r.left}</span>
            {r.right && <span className="tabular">{r.right}</span>}
          </div>
        );
        return animate ? (
          <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 + i * 0.28, duration: 0.2 }}>{line}</motion.div>
        ) : (
          <div key={i}>{line}</div>
        );
      })}
    </div>
  );

  return (
    <div className={cn("drop-shadow-[0_18px_28px_rgba(6,12,30,0.35)]", className)} aria-hidden>
      {animate ? (
        <div className="overflow-hidden">
          <motion.div initial={{ y: "-100%" }} animate={{ y: 0 }} transition={{ duration: 3.4, ease: "linear", delay: 0.4 }}>
            {paper}
            <Zigzag />
          </motion.div>
        </div>
      ) : (
        <>
          {paper}
          <Zigzag />
        </>
      )}
    </div>
  );
}
