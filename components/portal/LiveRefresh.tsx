"use client";

import { useRouter } from "next/navigation";
import { LIVE_DEVICE_POLL_INTERVAL_MS, usePolling } from "@/lib/hooks/usePolling";

/** Re-renders the surrounding Server Component page on the live-device interval. */
export function LiveRefresh({ enabled = true }: { enabled?: boolean }) {
  const router = useRouter();
  usePolling(() => router.refresh(), LIVE_DEVICE_POLL_INTERVAL_MS, enabled);
  return null;
}
