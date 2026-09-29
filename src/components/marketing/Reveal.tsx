"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/** Fades content up once as it scrolls into view. Honors reduced-motion via <MotionConfig>. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5, delay, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}
