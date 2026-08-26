"use client";

// Single controlled-polling primitive for "live" pages (§9, §28) — one
// interval per page, paused while the tab isn't visible, instead of every
// widget on a page independently polling the SLASH API. Callers pass a
// callback (usually `router.refresh()` for a Server Component page, since
// the actual data fetch lives server-side against lib/starlink/*).
import { useEffect, useRef } from "react";

export const DEFAULT_POLL_INTERVAL_MS = 45_000;

export function usePolling(callback: () => void, intervalMs: number = DEFAULT_POLL_INTERVAL_MS, enabled = true) {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    function tick() {
      if (document.visibilityState === "visible") callbackRef.current();
    }

    const id = setInterval(tick, intervalMs);
    // Also refresh immediately when the tab regains focus after being away
    // longer than the interval, instead of waiting for the next tick.
    let hiddenAt: number | null = null;
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (hiddenAt !== null && Date.now() - hiddenAt > intervalMs) {
        callbackRef.current();
        hiddenAt = null;
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs, enabled]);
}
