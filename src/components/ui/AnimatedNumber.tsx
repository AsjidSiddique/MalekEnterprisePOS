"use client";

import { animate, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

/** Counts up to `value` when it first appears or changes. Respects reduced-motion by showing the final number straight away. */
export function AnimatedNumber({ value, format = (n) => String(Math.round(n)), duration = 0.9, className }: { value: number; format?: (n: number) => string; duration?: number; className?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) { setShown(value); return; }
    const controls = animate(0, value, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: setShown });
    return () => controls.stop();
  }, [value, duration, reduce]);
  return <span className={className} aria-label={format(value)}><span aria-hidden>{format(shown)}</span></span>;
}
