"use client";

import { useEffect, useState } from "react";
import { API_HEALTH_URL } from "@/lib/api/config";
import { Spinner } from "@/components/ui/spinner";

/** Avoid flashing the overlay when the server is already warm. */
const SHOW_DELAY_MS = 1200;

export function ServerWakeOverlay() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let isSettled = false;
    const showTimer = window.setTimeout(() => {
      if (!isSettled) setIsVisible(true);
    }, SHOW_DELAY_MS);

    fetch(API_HEALTH_URL, { method: "GET", cache: "no-store" })
      .catch(() => {})
      .finally(() => {
        isSettled = true;
        window.clearTimeout(showTimer);
        setIsVisible(false);
      });

    return () => {
      isSettled = true;
      window.clearTimeout(showTimer);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4 backdrop-blur-sm"
    >
      <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-6 py-8 text-center shadow-lg">
        <Spinner className="h-8 w-8 text-zinc-900" />
        <p className="text-sm font-medium text-zinc-900">
          Almost there... this may take up to a minute if the app hasn&apos;t been used in a
          while.
        </p>
        <p className="text-xs text-zinc-600">Please stay on this page.</p>
      </div>
    </div>
  );
}
