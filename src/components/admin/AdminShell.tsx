"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Bell, ChevronsLeft, ChevronsRight, ExternalLink, FileText, KeyRound, LogOut, Menu, Plus, Rocket, Search, Users, X, Inbox } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";
import { useToast } from "@/components/ui/Toast";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { isDemoMode } from "@/lib/demo/flag";
import { cn, formatZAR } from "@/lib/utils";
import { loadDashboard } from "@/services/dashboardService";
import { useAuth } from "./AuthProvider";
import { CommandPalette } from "./CommandPalette";
import { GO_SHORTCUTS, ShortcutsHelp } from "./ShortcutsHelp";
import { ADMIN_NAV } from "./nav";

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="scroll-slim flex-1 overflow-y-auto px-3 py-4">
      {ADMIN_NAV.map((group, gi) => (
        <div key={gi} className={cn(gi > 0 && "mt-5")}>
          {group.label && !collapsed && <p className="mb-1.5 px-3 text-xs font-medium text-ink-400">{group.label}</p>}
          {group.label && collapsed && <div className="mx-3 mb-2 h-px bg-white/10" aria-hidden />}
          <ul className="space-y-0.5">
            {group.items.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link href={href} onClick={onNavigate} title={collapsed ? label : undefined} aria-current={active ? "page" : undefined}
                    className={cn("group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors", active ? "bg-white/[0.11] text-white" : "text-ink-200 hover:bg-white/[0.06] hover:text-white", collapsed && "justify-center px-0")}>
                    {active && <span className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-accent" aria-hidden />}
                    <Icon className={cn("h-[18px] w-[18px] shrink-0 transition-colors", active ? "text-accent" : "text-ink-300 group-hover:text-white")} aria-hidden />
                    <span className={cn(collapsed && "sr-only")}>{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarBody({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-gradient-to-b from-ink-950 to-ink-900">
      <div aria-hidden className="bg-dots pointer-events-none absolute inset-0 opacity-30" />
      <div className={cn("relative flex h-[68px] items-center px-5", collapsed && "justify-center px-0")}><Logo tone="light" compact={collapsed} /></div>
      <div className="relative flex min-h-0 flex-1 flex-col"><NavList collapsed={collapsed} onNavigate={onNavigate} /></div>
      <div className="relative border-t border-white/10 p-3">
        <Link href="/" target="_blank" className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] text-ink-300 transition hover:bg-white/[0.06] hover:text-white", collapsed && "justify-center px-0")}>
          <ExternalLink className="h-4 w-4" aria-hidden /><span className={cn(collapsed && "sr-only")}>View public site</span>
        </Link>
      </div>
    </div>
  );
}

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open, close]);
  return ref;
}

const CREATE = [
  { label: "New customer", href: "/admin/customers?new=1", icon: Users },
  { label: "New invoice", href: "/admin/invoices?new=1", icon: FileText },
  { label: "New release", href: "/admin/releases?new=1", icon: Rocket },
];

function QuickCreate() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div className="relative hidden sm:block" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-bold text-accent-ink shadow-btn transition hover:brightness-105">
        <Plus className="h-4 w-4" aria-hidden />New
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-52 overflow-hidden rounded-xl2 bg-surface p-1.5 shadow-pop ring-1 ring-line animate-rise">
          {CREATE.map(({ label, href, icon: Icon }) => (
            <button key={href} role="menuitem" type="button" onClick={() => { setOpen(false); router.push(href); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-ink-800 hover:bg-paper">
              <Icon className="h-4 w-4 text-ink-600" aria-hidden />{label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AttentionBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof loadDashboard>> | null>(null);
  const ref = useDismiss(open, () => setOpen(false));
  useEffect(() => { loadDashboard().then(setData).catch(() => undefined); }, []);
  const a = data?.attention;
  const items = a ? [
    a.overdue.length > 0 && { icon: AlertTriangle, tone: "text-bad bg-bad/10", text: `${data!.cards.overdueInvoices.count} overdue invoice${data!.cards.overdueInvoices.count === 1 ? "" : "s"}`, sub: `${formatZAR(data!.cards.overdueInvoices.amount)} outstanding`, href: "/admin/invoices" },
    a.expiringLicences.length > 0 && { icon: KeyRound, tone: "text-warn bg-warn/15", text: `${a.expiringLicences.length} licence${a.expiringLicences.length === 1 ? "" : "s"} expiring soon`, sub: "Within 14 days", href: "/admin/licenses" },
    a.newInquiries > 0 && { icon: Inbox, tone: "text-info bg-info/10", text: `${a.newInquiries} new message${a.newInquiries === 1 ? "" : "s"}`, sub: "From the contact form, last 7 days", href: "/admin/notifications" },
    a.draftReleases > 0 && { icon: Rocket, tone: "text-ink-700 bg-ink-100", text: `${a.draftReleases} draft release${a.draftReleases === 1 ? "" : "s"}`, sub: "Not published yet", href: "/admin/releases" },
  ].filter(Boolean) as { icon: typeof Bell; tone: string; text: string; sub: string; href: string }[] : [];
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={`Needs attention${items.length ? `, ${items.length} items` : ""}`} className="relative grid h-10 w-10 place-items-center rounded-xl text-ink-700 transition hover:bg-ink-100">
        <Bell className="h-5 w-5" />
        {items.length > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-signal ring-2 ring-surface" aria-hidden />}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl2 bg-surface shadow-pop ring-1 ring-line animate-rise">
          <p className="border-b border-line px-4 py-3 font-display text-base font-bold">Needs attention</p>
          {items.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted">{data ? "You're all caught up." : "Checking…"}</p> : (
            <ul className="p-1.5">{items.map((i) => (
              <li key={i.text}><Link href={i.href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-paper">
                <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", i.tone)}><i.icon className="h-4 w-4" aria-hidden /></span>
                <span><span className="block text-sm font-semibold">{i.text}</span><span className="block text-xs text-muted">{i.sub}</span></span>
              </Link></li>
            ))}</ul>
          )}
        </div>
      )}
    </div>
  );
}

function Topbar({ onMenu, collapsed, onToggleCollapse, onSearch }: { onMenu: () => void; collapsed: boolean; onToggleCollapse: () => void; onSearch: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const { user, signOut } = useAuth();
  const [menu, setMenu] = useState(false);
  const ref = useDismiss(menu, () => setMenu(false));
  const email = user?.email ?? "";
  const [isMac, setIsMac] = useState(false);
  useEffect(() => setIsMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);

  return (
    <header className="sticky top-0 z-30 flex h-[68px] items-center gap-3 border-b border-line bg-paper/85 px-4 backdrop-blur-md sm:px-6">
      <button type="button" onClick={onMenu} aria-label="Open menu" className="rounded-xl p-2 text-ink-700 hover:bg-ink-100 md:hidden"><Menu className="h-5 w-5" /></button>
      <button type="button" onClick={onToggleCollapse} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="hidden rounded-xl p-2 text-ink-600 hover:bg-ink-100 md:block">
        {collapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
      </button>
      <button type="button" onClick={onSearch} aria-label="Search" className="group flex h-10 w-10 shrink-0 items-center justify-center gap-3 rounded-xl border border-line bg-surface text-left text-sm text-ink-400 shadow-sm transition hover:border-ink-300 sm:w-full sm:max-w-md sm:justify-start sm:px-3.5">
        <Search className="h-4 w-4" aria-hidden /><span className="hidden flex-1 truncate sm:block">Search customers, invoices, pages</span>
        <kbd className="hidden rounded-md border border-line bg-paper px-1.5 py-0.5 font-sans text-[11px] text-muted sm:block">{isMac ? "⌘" : "Ctrl"} K</kbd>
      </button>
      <div className="ml-auto flex items-center gap-2">
        {isDemoMode && <span className="hidden rounded-full bg-accent/30 px-3 py-1 text-xs font-bold text-[#6B4300] ring-1 ring-accent-strong/30 md:block" title="Sample data. Nothing is saved.">Demo data</span>}
        <QuickCreate />
        <AttentionBell />
        <div className="relative" ref={ref}>
          <button type="button" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu} aria-label="Account menu, sign out"
            title="Account menu (sign out here)"
            className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-ink-700 to-ink-900 text-sm font-bold text-white ring-2 ring-surface transition hover:brightness-110">
            {(email[0] ?? "A").toUpperCase()}
          </button>
          {menu && (
            <div role="menu" className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-xl2 bg-surface shadow-pop ring-1 ring-line animate-rise">
              <div className="border-b border-line px-4 py-3.5"><p className="text-xs text-muted">Signed in as</p><p className="truncate text-sm font-semibold">{email}</p></div>
              <button role="menuitem" type="button" className="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-medium text-ink-800 hover:bg-paper"
                onClick={async () => { await signOut(); toast.info("You've been signed out."); router.replace("/admin/login"); }}>
                <LogOut className="h-4 w-4" aria-hidden />Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const { signOut } = useAuth();

  // Auto sign-out after 30 minutes with no mouse/keyboard/touch activity anywhere in the admin panel -
  // protects a shop PC that gets left signed in and unattended. See useIdleLogout for the exact rules.
  useIdleLogout(() => {
    signOut().finally(() => {
      toast.info("Signed out after 30 minutes of inactivity.");
      router.replace("/admin/login");
    });
  });

  useEffect(() => { try { setCollapsed(localStorage.getItem("admin.sidebar.collapsed") === "1"); } catch { /* storage unavailable */ } }, []);
  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    let armed = false;
    let timer = 0;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); return; }
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || el?.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      if (e.key === "?") { e.preventDefault(); setHelp(true); return; }
      if (armed) {
        armed = false; window.clearTimeout(timer);
        const hit = GO_SHORTCUTS.find(([k]) => k === e.key.toLowerCase());
        if (hit) { e.preventDefault(); router.push(hit[1]); }
        return;
      }
      if (e.key.toLowerCase() === "g") { armed = true; timer = window.setTimeout(() => { armed = false; }, 1200); }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); window.clearTimeout(timer); };
  }, [router]);

  const toggle = () => setCollapsed((c) => { try { localStorage.setItem("admin.sidebar.collapsed", c ? "0" : "1"); } catch { /* ignore */ } return !c; });

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-field focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink">Skip to content</a>
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden transition-[width] duration-200 md:block", collapsed ? "w-[76px]" : "w-[264px]")}><SidebarBody collapsed={collapsed} /></aside>

      <AnimatePresence>
        {drawer && (
          <motion.div className="fixed inset-0 z-50 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-ink-950/60" onClick={() => setDrawer(false)} aria-hidden />
            <motion.aside initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: "tween", duration: 0.2 }} className="absolute inset-y-0 left-0 w-72" aria-label="Menu">
              <SidebarBody collapsed={false} onNavigate={() => setDrawer(false)} />
              <button type="button" onClick={() => setDrawer(false)} aria-label="Close menu" className="absolute right-3 top-5 rounded-field p-1.5 text-ink-200 hover:bg-white/10"><X className="h-5 w-5" /></button>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn("transition-[padding] duration-200", collapsed ? "md:pl-[76px]" : "md:pl-[264px]")}>
        <Topbar onMenu={() => setDrawer(true)} collapsed={collapsed} onToggleCollapse={toggle} onSearch={() => setPalette(true)} />
        <main id="main" className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10">
          <motion.div key={pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>{children}</motion.div>
        </main>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      <ShortcutsHelp open={help} onClose={() => setHelp(false)} />
    </div>
  );
}
