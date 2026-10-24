"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, LifeBuoy, MessageSquare, AlertTriangle } from "lucide-react";
import { formatDateTime } from "@/lib/utils/format";
import type { CustomerSupportNotifications } from "@/lib/support/unread";
import type { EnrichedAlert } from "@/lib/terminals/alerts";

export function PortalAlertBell({
  support,
  alerts = [],
}: {
  support: CustomerSupportNotifications;
  alerts?: EnrichedAlert[];
}) {
  const activeAlerts = alerts.filter((a) => a.active);
  const total = support.unreadCount + activeAlerts.length;
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

  const hasNotifications = alerts.length > 0 || support.tickets.length > 0;

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
        <div className="absolute right-0 z-40 mt-2 w-88 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Notifications
            </span>
            {total > 0 && (
              <span className="rounded-full bg-red/15 px-2 py-0.5 text-[10px] font-bold text-red">
                {total} new
              </span>
            )}
          </div>

          {!hasNotifications ? (
            <p className="px-4 py-6 text-center text-xs text-text-muted">No new notifications.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto divide-y divide-line-soft">
              {/* Device Alerts Section */}
              {alerts.length > 0 && (
                <div>
                  <div className="bg-surface-raised/60 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber">
                    Device Alerts ({activeAlerts.length} active)
                  </div>
                  {alerts.slice(0, 8).map((a) => (
                    <Link
                      key={`alert-${a.id}`}
                      href={a.deviceId ? `/portal/devices/${encodeURIComponent(a.deviceId)}?tab=alerts` : "/portal/devices"}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-surface-raised transition-colors"
                    >
                      <AlertTriangle className={`mt-0.5 size-4 shrink-0 ${a.active ? "text-red" : "text-amber"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-text-primary">
                            {a.alertName}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                              a.active ? "bg-red/15 text-red" : "bg-surface-raised text-text-muted"
                            }`}
                          >
                            {a.active ? "Active" : "Resolved"}
                          </span>
                        </div>
                        <span className="block truncate text-xs text-text-muted">
                          {a.terminalLabel || "Device"} {a.description ? `· ${a.description}` : ""}
                        </span>
                        <span className="block text-[10px] text-text-muted">
                          {a.lastSeen ? formatDateTime(a.lastSeen) : a.firstSeen ? formatDateTime(a.firstSeen) : ""}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Support Tickets Section */}
              {support.tickets.length > 0 && (
                <div>
                  <div className="bg-surface-raised/60 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-accent-blue">
                    Support Messages
                  </div>
                  {support.tickets.map((t) => (
                    <Link
                      key={`ticket-${t.id}`}
                      href={`/portal/support/${t.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-surface-raised transition-colors"
                    >
                      {t.isReply ? (
                        <MessageSquare className="mt-0.5 size-4 shrink-0 text-accent-blue" />
                      ) : (
                        <LifeBuoy className="mt-0.5 size-4 shrink-0 text-accent-blue" />
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-text-primary">
                          {t.isReply ? "Support replied" : "New support ticket"} · #{t.ticketNumber}
                        </span>
                        <span className="block truncate text-xs text-text-muted" title={t.subject}>
                          {t.subject}
                        </span>
                        <span className="block text-[10px] text-text-muted">{formatDateTime(t.updatedAt)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {support.unreadCount > support.tickets.length && (
                <Link
                  href="/portal/support"
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2 text-center text-xs font-medium text-accent-blue hover:bg-surface-raised"
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

