"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, AlertTriangle } from "lucide-react";
import { formatDateTime, formatNumber } from "@/lib/utils/format";
import type { OpenCdrAlert } from "@/lib/cdr/alerts";

// Admin notifications: uploads with unallocated CDR records that nobody has
// acknowledged yet (acknowledge from the upload's page).
export function AdminAlertBell({ alerts, total }: { alerts: OpenCdrAlert[]; total: number }) {
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
        className="relative flex size-9 items-center justify-center rounded-full border border-line text-text-secondary hover:bg-surface-raised"
        aria-label={total > 0 ? `${total} unallocated CDR alert${total === 1 ? "" : "s"}` : "Notifications"}
        aria-expanded={open}
      >
        <Bell className="size-4" />
        {total > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber px-1 text-[10px] font-bold text-[#1a1203]">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
          <p className="border-b border-line px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Alerts</p>
          {alerts.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-text-muted">No open alerts.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {alerts.map((a) => (
                <Link
                  key={`${a.pipeline}-${a.id}`}
                  href={a.href}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 border-b border-line-soft px-4 py-3 last:border-0 hover:bg-surface-raised"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" />
                  <span className="min-w-0">
                    <span className="block text-sm text-text-primary">
                      {formatNumber(a.unallocatedRows)} unallocated CDR record{a.unallocatedRows === 1 ? "" : "s"}
                    </span>
                    <span className="block truncate text-xs text-text-muted">
                      {a.fileName} · {a.pipeline === "RATED" ? "Usage upload" : "Pricing import"}
                    </span>
                    <span className="block text-[11px] text-text-muted">{formatDateTime(a.createdAt)}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
