"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A soft light that follows the pointer across a card. Purely decorative; does nothing on touch screens. */
export function Spotlight({ children, className, tone = "rgb(255 199 44 / 0.16)" }: { children: ReactNode; className?: string; tone?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref} className={cn("group/spot relative", className)}
      onPointerMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r || e.pointerType === "touch") return;
        ref.current!.style.setProperty("--mx", `${e.clientX - r.left}px`);
        ref.current!.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
    >
      {children}
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
        style={{ background: `radial-gradient(420px circle at var(--mx, 50%) var(--my, 50%), ${tone}, transparent 65%)` }} />
    </div>
  );
}
