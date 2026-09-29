"use client";

import { useEffect } from "react";

/** Last line of defence: catches errors thrown by the root layout itself, which app/error.tsx cannot. */
export default function GlobalRootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[global-error] root layout crashed:", error, error.digest ? `(reference ${error.digest})` : "");
  }, [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#F2F5FB", color: "#0C1A3D" }}>
        <div role="alert" style={{ minHeight: "100vh", display: "grid", placeItems: "center", textAlign: "center", padding: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, margin: 0 }}>Something went wrong</h1>
            <p style={{ maxWidth: 360, margin: "8px auto 24px", opacity: 0.7 }}>{error.digest ? `Reference ${error.digest}. ` : ""}Please try again.</p>
            <button onClick={reset} style={{ background: "#0C1A3D", color: "#fff", border: 0, borderRadius: 10, padding: "12px 20px", fontSize: 15, cursor: "pointer" }}>Try again</button>
          </div>
        </div>
      </body>
    </html>
  );
}
