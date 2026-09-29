"use client";

import { AnimatePresence, motion, useScroll, useSpring } from "framer-motion";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { PUBLIC_NAV } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.4 });
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header className={cn("sticky top-0 z-50 transition-colors duration-200", scrolled || open ? "glass border-b border-white/10" : "bg-ink-900 border-b border-transparent")}>
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:rounded-field focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink">Skip to content</a>
      <div className="mx-auto flex h-[68px] max-w-6xl items-center gap-10 px-5">
        <Link href="/" aria-label="Malek Enterprise POS home"><Logo tone="light" /></Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {PUBLIC_NAV.map((l) => {
            const active = pathname === l.href;
            return (
              <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}
                className={cn("relative rounded-full px-3.5 py-2 text-sm font-medium transition-colors", active ? "bg-white/10 text-white" : "text-ink-200 hover:bg-white/5 hover:text-white")}>
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <Link href="/contact" className="rounded-full px-3.5 py-2 text-sm font-medium text-ink-200 hover:text-white">Contact</Link>
          <ButtonLink href="/download" size="md">Download</ButtonLink>
        </div>
        <button type="button" className="ml-auto rounded-field p-2 text-white hover:bg-white/10 md:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? "Close menu" : "Open menu"}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      <motion.div aria-hidden style={{ scaleX: progress }} className="pointer-events-none absolute inset-x-0 -bottom-px h-[3px] origin-left bg-gradient-to-r from-accent-strong via-accent to-[#FFE08A]" />
      <AnimatePresence>
        {open && (
          <motion.nav id="mobile-nav" aria-label="Mobile" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-white/10 md:hidden">
            <div className="flex flex-col gap-1 px-5 py-4">
              {[...PUBLIC_NAV, { href: "/contact", label: "Contact" }].map((l) => (
                <Link key={l.href} href={l.href} className="rounded-field px-3 py-3 text-base font-medium text-ink-100 hover:bg-white/10">{l.label}</Link>
              ))}
              <ButtonLink href="/download" size="lg" className="mt-2">Download</ButtonLink>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
