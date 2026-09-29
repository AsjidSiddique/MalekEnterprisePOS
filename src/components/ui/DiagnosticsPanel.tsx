"use client";

import { CheckCircle2, Loader2, Stethoscope, XCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "./Button";
import { withTimeout } from "@/lib/async";

interface CheckRow { id: string; label: string; ok: boolean; detail: string; fix?: string }
interface Report { ok: boolean; checkedAt: string; deployment: { environment: string; commit: string; region: string }; checks: CheckRow[] }

/**
 * "Run diagnostics" - asks the SERVER (/api/health) whether Firebase is configured and reachable, so a
 * "client is offline" message can be traced to its real cause (e.g. the Firestore database was never
 * created) instead of guessing whether it's the browser or the network.
 */
export function DiagnosticsPanel() {
  const [state, setState] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [report, setReport] = useState<Report | null>(null);
  const [problem, setProblem] = useState("");

  const run = async () => {
    setState("running");
    setProblem("");
    try {
      const res = await withTimeout(fetch("/api/health", { cache: "no-store" }), 40_000, "The health check");
      // /api/health answers 503 (with a full report) when something is wrong, so read the body regardless of status.
      const body = (await res.json()) as Report | { error: string };
      if ("error" in body) throw new Error(body.error);
      console.log("[diagnostics]", body);
      setReport(body);
      setState("done");
    } catch (e) {
      console.error("[diagnostics] could not run the health check:", e);
      setProblem(e instanceof Error ? e.message : "Could not run the health check.");
      setState("failed");
    }
  };

  return (
    <div className="mt-6 w-full max-w-xl text-left">
      <div className="flex justify-center">
        <Button variant="secondary" onClick={run} disabled={state === "running"}>
          {state === "running" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Stethoscope className="h-4 w-4" aria-hidden />}
          {state === "running" ? "Checking..." : "Run diagnostics"}
        </Button>
      </div>
      {state === "failed" && <p role="alert" className="mt-3 rounded-field bg-bad/10 px-3 py-2 text-sm text-[#A22B3B]">Couldn&apos;t run the check: {problem}</p>}
      {report && (
        <div className="mt-4 rounded-xl border border-line bg-white p-4" role="status">
          <p className="text-sm font-semibold text-ink-900">{report.ok ? "Everything checks out on the server." : "Found a problem:"}</p>
          <p className="mt-0.5 text-xs text-muted">Live build {report.deployment.commit} ({report.deployment.environment}), checked {new Date(report.checkedAt).toLocaleTimeString()}</p>
          <ul className="mt-3 space-y-3">
            {report.checks.map((c) => (
              <li key={c.id} className="flex gap-2.5 text-sm">
                {c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-label="passed" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-bad" aria-label="failed" />}
                <div>
                  <p className="font-medium text-ink-900">{c.label}</p>
                  <p className="text-muted">{c.detail}</p>
                  {!c.ok && c.fix && <p className="mt-1 font-medium text-ink-900">Fix: <span className="font-normal">{c.fix}</span></p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
