import { cn } from "@/lib/utils";

const PALETTE = [
  "from-ink-600 to-ink-900 text-white",
  "from-accent to-[#FFAE00] text-accent-ink",
  "from-info to-ink-700 text-white",
  "from-live to-ok text-ink-950",
  "from-signal to-[#B12A3B] text-white",
  "from-ink-400 to-ink-700 text-white",
];

const initials = (name: string) => {
  const words = name.replace(/[^\p{L}\p{N}\s'-]/gu, " ").split(/\s+/).filter((w) => w && !/^(the|of|and|&)$/i.test(w));
  return ((words[0]?.[0] ?? "?") + (words[1]?.[0] ?? "")).toUpperCase();
};

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

const SIZES = { sm: "h-8 w-8 text-[11px]", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-lg" };

/** Initials on a colour that's always the same for the same name, so people are easy to recognise in a list. */
export function Avatar({ name, size = "md", className }: { name: string; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-xl bg-gradient-to-br font-display font-extrabold shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]", PALETTE[hash(name) % PALETTE.length], SIZES[size], className)}>
      {initials(name)}
    </span>
  );
}
