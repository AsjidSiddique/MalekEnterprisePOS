import { AlertTriangle, RotateCw, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";
import { explainError, isConnectivityKind } from "@/lib/firebase/explain";
import { DiagnosticsPanel } from "./DiagnosticsPanel";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-field bg-ink-100", className)} aria-hidden>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="panel p-4" role="status" aria-label="Loading">
      <Skeleton className="mb-4 h-9 w-64" />
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="mb-2 h-11 w-full" />)}
    </div>
  );
}

export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} className="h-28" />)}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="relative mb-5">
        <span className="absolute -inset-3 rounded-full border border-dashed border-ink-200" aria-hidden />
        <div className="relative grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-ink-100 to-white text-ink-700 shadow-card ring-1 ring-line"><Icon className="h-6 w-6" aria-hidden /></div>
      </div>
      <h3 className="font-display text-lg font-bold text-ink-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", error, onRetry }: { title?: string; error?: Error | string | null; onRetry?: () => void }) {
  // Translate raw Firebase/network errors into a plain-English cause and a next step, and offer the
  // server-side health check when the failure looks like a connection/setup problem.
  const why = error ? explainError(error) : null;
  const message = why?.message;
  return (
    <div className="panel flex flex-col items-center px-6 py-12 text-center" role="alert">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-bad/10 text-bad ring-1 ring-bad/20"><AlertTriangle className="h-6 w-6" aria-hidden /></div>
      <h3 className="font-display text-lg font-bold text-ink-900">{title}</h3>
      {message && <p className="mt-1 max-w-md text-sm text-muted">{message}</p>}
      {why && why.kind !== "unknown" && <p className="mt-2 max-w-md text-sm text-ink-900">{why.hint}</p>}
      {onRetry && <Button variant="secondary" className="mt-5" onClick={onRetry}><RotateCw className="h-4 w-4" aria-hidden />Try again</Button>}
      {why && isConnectivityKind(why.kind) && <DiagnosticsPanel />}
    </div>
  );
}
