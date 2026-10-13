"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, LifeBuoy, MessageSquare } from "lucide-react";
import { formatDateTime } from "@/lib/utils/format";
import type { CustomerSupportNotifications } from "@/lib/support/unread";

export function PortalAlertBell({
  support,
}: {
  support: CustomerSupportNotifications;
}) {
  const total = support.unreadCount;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex size-9 items-center justify-center rounded-full border border-line text-text-secondary hover:bg-surface-raised transition-colors"
        aria-label={total > 0 ? `${total} notification${total === 1 ? "" : "s"}` : "Notifications"}
        aria-expanded={open}
      >
        <Bell className="size-4" />
        {total > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red px-1 text-[10px] font-bold text-white">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
          <p className="border-b border-line px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Notifications
          </p>
          {support.tickets.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-text-muted">No new notifications.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {support.tickets.map((t) => (
                <Link
                  key={`ticket-${t.id}`}
                  href={`/portal/support/${t.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 border-b border-line-soft px-4 py-3 last:border-0 hover:bg-surface-raised"
                >
                  {t.isReply ? (
                    <MessageSquare className="mt-0.5 size-4 shrink-0 text-red" />
                  ) : (
                    <LifeBuoy className="mt-0.5 size-4 shrink-0 text-red" />
                  )}
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-text-primary">
                      {t.isReply ? "Support replied" : "New support ticket"} · #{t.ticketNumber}
                    </span>
                    <span className="block truncate text-xs text-text-muted" title={t.subject}>
                      {t.subject}
                    </span>
                    <span className="block text-[11px] text-text-muted">{formatDateTime(t.updatedAt)}</span>
                  </span>
                </Link>
              ))}
              {support.unreadCount > support.tickets.length && (
                <Link
                  href="/portal/support"
                  onClick={() => setOpen(false)}
                  className="block border-b border-line-soft px-4 py-2.5 text-center text-xs font-medium text-accent-blue hover:bg-surface-raised"
                >
                  View all {support.unreadCount} unread tickets
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

