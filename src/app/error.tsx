"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] page crashed:", error, error.digest ? `(reference ${error.digest})` : "");
  }, [error]);
  return (
    <div className="grid min-h-screen place-items-center bg-paper px-6 text-center" role="alert">
      <div>
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-1 max-w-sm text-muted">{error.digest ? `Reference ${error.digest}. ` : ""}Try again, and if it keeps happening let us know.</p>
        <Button variant="dark" className="mt-6" onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
