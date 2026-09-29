import { cn } from "@/lib/utils";

type Tone = "neutral" | "ok" | "warn" | "bad" | "info" | "accent";

const tones: Record<Tone, string> = {
  neutral: "bg-ink-100 text-[#45506B] ring-ink-400/20",
  ok: "bg-ok/12 text-[#0B6B45] ring-ok/25",
  warn: "bg-warn/15 text-[#8A5200] ring-warn/25",
  bad: "bg-bad/12 text-[#A22B3B] ring-bad/25",
  info: "bg-info/12 text-[#2A4FB0] ring-info/25",
  accent: "bg-accent/30 text-[#6B4300] ring-accent-strong/30",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", tones[tone], className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  ACTIVE: "ok", PAID: "ok", succeeded: "ok", published: "ok", active: "ok", sent: "ok",
  PENDING: "info", queued: "info", pending: "info",
  OVERDUE: "bad", SUSPENDED: "bad", REVOKED: "bad", EXPIRED: "bad", failed: "bad",
  GRACE: "warn", DISABLED: "warn", refunded: "warn",
  CANCELLED: "neutral", draft: "neutral", archived: "neutral", inactive: "neutral", NONE: "neutral", read: "neutral",
};

const LABEL: Record<string, string> = { NONE: "No subscription", bad: "Failed" };

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/** One consistent badge for every status in the product. */
export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{LABEL[status] ?? titleCase(status.replace(/_/g, " "))}</Badge>;
}
