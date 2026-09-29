"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import type { PricingPlan } from "@/types";
import { formatZAR, round2 } from "@/lib/utils";

export function PriceCalculator({ plans }: { plans: PricingPlan[] }) {
  const [planId, setPlanId] = useState(plans.find((p) => p.highlighted)?.id ?? plans[0]?.id ?? "");
  const plan = plans.find((p) => p.id === planId) ?? plans[0];
  const [count, setCount] = useState(plan?.minTerminals ?? 1);
  if (!plan) return null;

  const terminals = Math.max(count, plan.minTerminals);
  const clamp = (n: number) => setCount(Math.min(Math.max(Number.isFinite(n) ? Math.floor(n) : 1, plan.minTerminals), 500));

  return (
    <div className="relative overflow-hidden rounded-xl3 bg-ink-900 p-7 text-white shadow-lift sm:p-9">
      <div aria-hidden className="bg-dots absolute inset-0" />
      <div className="relative grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h2 className="display-wide text-2xl font-bold sm:text-3xl">What would your shop pay?</h2>
          <div className="mt-6 flex flex-wrap items-end gap-5">
            {plans.length > 1 && (
              <div>
                <label htmlFor="calc-plan" className="mb-1.5 block text-sm text-ink-200">Plan</label>
                <select id="calc-plan" className="field min-w-[10rem] border-white/15 bg-white/10 text-white" value={plan.id} onChange={(e) => { setPlanId(e.target.value); setCount((c) => Math.max(c, plans.find((p) => p.id === e.target.value)?.minTerminals ?? 1)); }}>
                  {plans.map((p) => <option key={p.id} value={p.id} className="text-ink-900">{p.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="calc-count" className="mb-1.5 block text-sm text-ink-200">Tills</label>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="One fewer till" onClick={() => clamp(terminals - 1)} className="grid h-11 w-11 place-items-center rounded-xl border border-white/20 transition hover:bg-white/10"><Minus className="h-4 w-4" /></button>
                <input id="calc-count" inputMode="numeric" className="field h-11 w-20 border-white/15 bg-white/10 text-center text-lg font-bold tabular text-white" value={terminals} onChange={(e) => clamp(Number(e.target.value))} />
                <button type="button" aria-label="One more till" onClick={() => clamp(terminals + 1)} className="grid h-11 w-11 place-items-center rounded-xl border border-white/20 transition hover:bg-white/10"><Plus className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        </div>
        <div className="md:text-right" aria-live="polite">
          <p className="text-sm text-ink-300">{terminals} × {formatZAR(plan.pricePerTerminal)}</p>
          <p className="font-display text-5xl font-extrabold tabular sm:text-6xl"><span className="text-accent">R</span>{formatZAR(round2(terminals * plan.pricePerTerminal)).replace("R ", "")}</p>
          <p className="text-sm text-ink-300">per month, before VAT</p>
        </div>
      </div>
    </div>
  );
}
