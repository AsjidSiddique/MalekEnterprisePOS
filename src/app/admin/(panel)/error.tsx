"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/States";

/** Catches a crash inside any admin page so the sidebar/top bar stay usable and the real error is logged. */
export default function AdminPanelError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[admin] page crashed:", error, error.digest ? `(reference ${error.digest})` : "");
  }, [error]);
  return (
    <div className="p-6">
      <ErrorState title="This page hit a problem" error={error} onRetry={reset} />
      {error.digest && <p className="mt-3 text-center text-xs text-muted">Reference {error.digest}</p>}
    </div>
  );
}
