"use client";

import { MotionConfig } from "framer-motion";
import { useEffect, type ReactNode } from "react";
import { ToastProvider } from "@/components/ui/Toast";

/**
 * Site-wide safety net: catches whatever individual try/catch blocks don't. A React render error
 * that isn't caught by any component's own error handling, a promise that rejects without a .catch
 * anywhere, a third-party script throwing - all of these previously vanished into the void unless
 * someone happened to have DevTools open at that exact moment. Now every one of them is printed with
 * a clear, greppable prefix, so "something's broken somewhere on this page" is diagnosable from the
 * Console tab instead of needing a fresh bug report and a guess at where to even start looking.
 * This never sends anything anywhere - it only makes the existing browser console more complete.
 */
function useGlobalErrorLogging() {
  useEffect(() => {
    // Browser extensions (search helpers, translators, ad blockers) sometimes throw errors that show up in the
    // console (e.g. "searchAnalyzer.js: Search engine null is not supported"). Those are not from this site, so
    // they are labelled instead of being mistaken for our own bugs.
    const isForeign = (file?: string) => Boolean(file) && !file!.startsWith(window.location.origin);
    const onError = (e: ErrorEvent) => {
      if (isForeign(e.filename)) return console.debug("[global] Ignored an error from outside this site (usually a browser extension):", e.filename, e.message);
      console.error("[global] Uncaught error:", e.error ?? e.message, e);
    };
    const onRejection = (e: PromiseRejectionEvent) => console.error("[global] Unhandled promise rejection:", e.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
}

export function Providers({ children }: { children: ReactNode }) {
  useGlobalErrorLogging();
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>{children}</ToastProvider>
    </MotionConfig>
  );
}
