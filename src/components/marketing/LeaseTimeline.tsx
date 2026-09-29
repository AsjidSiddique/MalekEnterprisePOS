import { cn } from "@/lib/utils";

/** What happens to the tills when the internet goes down: a checked-in licence keeps trading for the offline allowance. */
export function LeaseTimeline({ days = 7 }: { days?: number }) {
  const cells = [{ label: "Checked in", tone: "live" as const }, ...Array.from({ length: days }, (_, i) => ({ label: `Day ${i + 1}`, tone: "ok" as const })), { label: "Check in", tone: "warn" as const }];
  return (
    <figure>
      <div className="flex gap-1.5" role="img" aria-label={`After a licence check the tills keep trading for up to ${days} days without internet, then need to check in again.`}>
        {cells.map((c, i) => (
          <div key={i} className={cn("flex-1", i === 0 || i === cells.length - 1 ? "flex-[1.6]" : "")}>
            <div className={cn("h-3 rounded-full", c.tone === "live" && "bg-live", c.tone === "ok" && "bg-live/35", c.tone === "warn" && "bg-accent")} />
            <p className={cn("mt-2 text-center text-[11px]", c.tone === "warn" ? "font-semibold text-accent" : c.tone === "live" ? "font-semibold text-live" : "text-ink-300")}>{c.label}</p>
          </div>
        ))}
      </div>
      <figcaption className="mt-5 text-sm text-ink-200">Trading carries on through the offline allowance ({days} days by default). Then the server checks in once and the clock resets.</figcaption>
    </figure>
  );
}
