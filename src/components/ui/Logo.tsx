import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Real product mark (public/logo-mark.png): the till/card artwork on a light rounded tile.
 * The tile stays light on purpose — the source art is multi-tone blue/navy and reads poorly with
 * halo-fringed edges directly on the dark navbar, so it sits on its own small paper-coloured chip
 * the same way the previous placeholder badge did. Regenerate public/logo-mark.png (512x512,
 * transparent artwork pre-composited onto a light tile) if the source logo ever changes.
 */
export function Logo({ className, tone = "dark", compact = false }: { className?: string; tone?: "dark" | "light"; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <Image
        src="/logo-mark.png"
        alt="Malek Enterprise POS logo"
        width={44}
        height={44}
        priority
        className="shrink-0 rounded-[11px] drop-shadow-[0_6px_10px_rgb(20_110_200/0.25)]"
      />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className={cn("font-display text-[23px] font-extrabold tracking-tight", tone === "light" ? "text-white" : "text-ink-900")}>Malek</span>
          <span className={cn("mt-[3px] text-[11.5px] font-medium tracking-[0.06em]", tone === "light" ? "text-ink-300" : "text-muted")}>Enterprise POS</span>
        </span>
      )}
    </span>
  );
}
