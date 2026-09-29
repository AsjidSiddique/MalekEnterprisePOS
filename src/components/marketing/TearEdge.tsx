import { cn } from "@/lib/utils";

/** A torn-receipt edge. Place it at the bottom of a section and set `fill` to the colour of the section below. */
export function TearEdge({ fill = "rgb(var(--paper))", flip = false, className }: { fill?: string; flip?: boolean; className?: string }) {
  const teeth = 72;
  const w = 1440 / teeth;
  const d = `M0 14 ${Array.from({ length: teeth }, (_, i) => `L${i * w + w / 2} 0 L${(i + 1) * w} 14`).join(" ")} V16 H0 Z`;
  return (
    <svg viewBox="0 0 1440 16" preserveAspectRatio="none" className={cn("block h-3 w-full sm:h-4", flip && "rotate-180", className)} aria-hidden>
      <path d={d} fill={fill} />
    </svg>
  );
}
