"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { withTimeout } from "@/lib/async";
import { explainError } from "@/lib/firebase/explain";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

/** Runs an async loader on mount and whenever `deps` change. Keeps previous data visible while reloading. */
export function useAsyncData<T>(loader: () => Promise<T>, deps: readonly unknown[] = []): AsyncState<T> {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: Error | null }>({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    // 30s ceiling: Firestore can leave a request pending forever when it can't connect, which would
    // otherwise show a loading skeleton indefinitely instead of an error you can act on.
    withTimeout(loaderRef.current(), 30_000, "Loading this page")
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((e: unknown) => {
        // Always print the real error to the browser console, even though the page also shows a
        // friendly "Couldn't load X" message. The friendly message is deliberately short (it's for
        // the person using the site), but the full error - stack trace, Firestore error .code, etc. -
        // is what actually identifies the cause, and previously it was only visible by clicking into
        // React state in devtools. Now it's one click into the Console tab, on every single failed
        // load anywhere in the admin panel, without hunting for the exact page.
        console.error("[useAsyncData] load failed:", e);
        const why = explainError(e);
        console.error(`[useAsyncData] diagnosis: ${why.kind} - ${why.hint}`);
        if (!cancelled) setState({ data: null, loading: false, error: e instanceof Error ? e : new Error(String(e)) });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
