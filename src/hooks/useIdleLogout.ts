"use client";

import { useEffect, useRef } from "react";

const IDLE_LIMIT_MS = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "wheel", "touchstart", "scroll"] as const;

/**
 * Signs the admin out after IDLE_LIMIT_MS of no mouse/keyboard/touch/scroll activity anywhere on the
 * page. Mount this once, only while genuinely inside the authenticated admin panel (see AdminShell) -
 * mounting it on the public site or the login page would make no sense, since there's no session to
 * expire there.
 *
 * Deliberately a plain browser-side timer, not a Firestore-backed "last seen" timestamp: it only
 * needs to protect a shop PC that's signed in and left unattended, which is a client-side concern.
 * Activity is listened for with { passive: true } so this never slows down scrolling/typing, and the
 * timer is reset (not re-created) on every event rather than tearing down/re-adding listeners, so it
 * stays cheap even on a very active page.
 */
export function useIdleLogout(onIdle: () => void) {
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        console.warn(`[useIdleLogout] No activity for ${IDLE_LIMIT_MS / 60000} minutes - signing out.`);
        onIdleRef.current();
      }, IDLE_LIMIT_MS);
    };

    reset();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, reset, { passive: true }));
    // Coming back to this tab after it was in the background (where timers can be throttled by the
    // browser) should also count as "check whether we've been idle too long", so re-check on focus too.
    window.addEventListener("visibilitychange", reset);

    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, reset));
      window.removeEventListener("visibilitychange", reset);
    };
  }, []);
}
