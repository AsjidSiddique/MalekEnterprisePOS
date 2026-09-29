import { ReceiptStub } from "./ReceiptStub";

const LINES = [
  ["AA batteries 4pk", "2", "79.90"],
  ["Extension cord 5m", "1", "129.00"],
  ["Cable ties 100pk", "1", "24.50"],
];

/** Hero visual: a till screen with the slip printing out beneath it. Pure CSS/markup, no screenshots. */
export function ProductMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[440px]" aria-hidden>
      <div className="rounded-[14px] border border-white/15 bg-ink-800 p-3 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)]">
        <div className="mb-2 flex items-center gap-1.5 px-1">
          <span className="h-2 w-2 rounded-full bg-white/25" /><span className="h-2 w-2 rounded-full bg-white/25" /><span className="h-2 w-2 rounded-full bg-white/25" />
          <span className="ml-auto text-[11px] text-ink-300">Till 02</span>
        </div>
        <div className="rounded-[8px] bg-ink-950/70 p-3">
          <div className="mb-2 grid grid-cols-[1fr_auto_auto] gap-x-4 px-1 text-[10px] text-ink-400">
            <span>Item</span><span>Qty</span><span className="text-right">Price</span>
          </div>
          {LINES.map(([n, q, p]) => (
            <div key={n} className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-t border-white/5 px-1 py-2 text-[13px] text-ink-100">
              <span>{n}</span><span className="tabular text-ink-300">{q}</span><span className="tabular text-right">{p}</span>
            </div>
          ))}
          <div className="mt-2 flex items-end justify-between border-t border-white/10 px-1 pt-3">
            <span className="text-xs text-ink-300">Total</span>
            <span className="font-display text-3xl font-semibold tabular text-white">R 233.40</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-[6px] bg-white/10 py-2 text-center text-xs font-semibold text-white">Cash</div>
            <div className="rounded-[6px] bg-accent py-2 text-center text-xs font-bold text-accent-ink">Card</div>
          </div>
        </div>
      </div>
      {/* printer slot */}
      <div className="relative z-10 mx-6 -mt-1 h-3 rounded-b-md bg-ink-950 shadow-inner" />
      <div className="relative mx-9 -mt-1.5 h-[318px] overflow-hidden">
        <ReceiptStub animate />
      </div>
    </div>
  );
}
