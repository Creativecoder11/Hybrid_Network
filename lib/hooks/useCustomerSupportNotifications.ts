"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import type { CustomerSupportNotifications } from "@/lib/support/unread";
import type { EnrichedAlert } from "@/lib/terminals/alerts";

const POLL_INTERVAL_MS = 20_000;

export type PortalNotificationsPayload = {
  support: CustomerSupportNotifications;
  alerts: EnrichedAlert[];
};

async function fetchNotifications(url: string): Promise<PortalNotificationsPayload> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`notifications ${res.status}`);
  const body = (await res.json()) as { support: CustomerSupportNotifications; alerts?: EnrichedAlert[] };
  return {
    support: body.support,
    alerts: body.alerts ?? [],
  };
}

/**
 * Live notification state (Support & Device Alerts) for the customer portal shell.
 */
export function usePortalNotifications(
  initial: PortalNotificationsPayload
): PortalNotificationsPayload {
  const pathname = usePathname();
  const router = useRouter();
  const { data, mutate } = useSWR("/api/portal/notifications", fetchNotifications, {
    fallbackData: initial,
    refreshInterval: POLL_INTERVAL_MS,
    revalidateOnFocus: true,
    revalidateOnMount: false,
    keepPreviousData: true,
  });

  // Opening a ticket marks it read on the server; refresh the badge right after navigating.
  useEffect(() => {
    void mutate();
  }, [pathname, mutate]);

  // Support notifications announcement
  const announcedSupport = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    const tickets = data?.support.tickets ?? [];
    if (announcedSupport.current === null) {
      announcedSupport.current = new Map(tickets.map((t) => [t.id, t.updatedAt]));
      return;
    }
    const seen = announcedSupport.current;
    let changed = false;
    for (const t of tickets) {
      if (seen.get(t.id) === t.updatedAt) continue;
      seen.set(t.id, t.updatedAt);
      changed = true;
      if (pathname === `/portal/support/${t.id}`) {
        router.refresh();
        continue;
      }
      toast.info(t.isReply ? `New reply on #${t.ticketNumber}` : `New support ticket #${t.ticketNumber}`, {
        description: `Support Team: ${t.subject}`,
        action: { label: "View", onClick: () => router.push(`/portal/support/${t.id}`) },
        duration: 10_000,
      });
    }
    if (changed && pathname === "/portal/support") router.refresh();
    const current = new Set(tickets.map((t) => t.id));
    for (const id of seen.keys()) if (!current.has(id)) seen.delete(id);
  }, [data?.support, pathname, router]);

  // Device alerts announcement
  const announcedAlerts = useRef<Set<string> | null>(null);
  useEffect(() => {
    const alerts = data?.alerts ?? [];
    const activeAlerts = alerts.filter((a) => a.active);
    if (announcedAlerts.current === null) {
      announcedAlerts.current = new Set(activeAlerts.map((a) => a.id));
      return;
    }
    const seen = announcedAlerts.current;
    for (const a of activeAlerts) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      toast.warning(`Alert: ${a.alertName}`, {
        description: `${a.terminalLabel || "Device"}: ${a.description || "Active device alert reported"}`,
        action: a.deviceId
          ? {
              label: "View Device",
              onClick: () => router.push(`/portal/devices/${encodeURIComponent(a.deviceId!)}?tab=alerts`),
            }
          : undefined,
        duration: 10_000,
      });
    }
    const current = new Set(activeAlerts.map((a) => a.id));
    for (const id of seen) if (!current.has(id)) seen.delete(id);
  }, [data?.alerts, router]);

  return data ?? initial;
}

export function useCustomerSupportNotifications(
  initial: CustomerSupportNotifications
): CustomerSupportNotifications {
  const notifications = usePortalNotifications({ support: initial, alerts: [] });
  return notifications.support;
}

