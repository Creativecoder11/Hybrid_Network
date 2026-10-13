"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import type { CustomerSupportNotifications } from "@/lib/support/unread";

const POLL_INTERVAL_MS = 20_000;

async function fetchNotifications(url: string): Promise<CustomerSupportNotifications> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`notifications ${res.status}`);
  const body = (await res.json()) as { support: CustomerSupportNotifications };
  return body.support;
}

/**
 * Live unread-support state for the customer portal shell. The portal layout
 * doesn't re-render on client navigation, so without polling the Support badge
 * would only change on a full page reload. Pops a toast when an admin replies
 * or creates a ticket for the customer while they are on the site.
 */
export function useCustomerSupportNotifications(
  initial: CustomerSupportNotifications
): CustomerSupportNotifications {
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

  // Each ticket is announced once per unread spell: seen ids are remembered
  // until the ticket drops out of the unread list.
  const announced = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    const tickets = data?.tickets ?? [];
    if (announced.current === null) {
      // First render: what was already unread at page load isn't "new".
      announced.current = new Map(tickets.map((t) => [t.id, t.updatedAt]));
      return;
    }
    const seen = announced.current;
    let changed = false;
    for (const t of tickets) {
      if (seen.get(t.id) === t.updatedAt) continue;
      seen.set(t.id, t.updatedAt);
      changed = true;
      if (pathname === `/portal/support/${t.id}`) {
        // Already looking at it: reload to show the reply (which also marks it read).
        router.refresh();
        continue;
      }
      toast.info(t.isReply ? `New reply on #${t.ticketNumber}` : `New support ticket #${t.ticketNumber}`, {
        description: `Support Team: ${t.subject}`,
        action: { label: "View", onClick: () => router.push(`/portal/support/${t.id}`) },
        duration: 10_000,
      });
    }
    // Keep the open Support list in step without a manual reload.
    if (changed && pathname === "/portal/support") router.refresh();
    const current = new Set(tickets.map((t) => t.id));
    for (const id of seen.keys()) if (!current.has(id)) seen.delete(id);
  }, [data, pathname, router]);

  return data ?? initial;
}

