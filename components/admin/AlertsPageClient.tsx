"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Search, ShieldOff } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { Tabs } from "@/components/ui/Tabs";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/utils/format";
import type { EnrichedAlert } from "@/lib/terminals/alerts";

const SEVERITY_TONE: Record<string, BadgeTone> = {
  CRITICAL: "red",
  MAJOR: "red",
  MINOR: "amber",
  WARNING: "amber",
  INFO: "blue",
};

function AlertTable({ rows }: { rows: EnrichedAlert[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No alerts"
        description="No alert episodes are recorded for your terminals right now."
      />
    );
  }
  return (
    <TableContainer>
      <Table>
        <THead>
          <TR>
            <TH>Device</TH>
            <TH>Customer</TH>
            <TH>Type</TH>
            <TH>Message</TH>
            <TH>Severity</TH>
            <TH>First Seen</TH>
            <TH>Last Seen</TH>
            <TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((a, i) => (
            <TR key={a.id ?? `${a.userTerminalId}-${i}`}>
              <TD className="font-medium text-text-primary">{a.terminalLabel ?? "Unknown device"}</TD>
              <TD>{a.customerName ?? <span className="text-text-muted">—</span>}</TD>
              <TD>{a.type ?? <span className="text-text-muted">—</span>}</TD>
              <TD className="max-w-xs truncate">{a.message ?? <span className="text-text-muted">—</span>}</TD>
              <TD>
                {a.severity ? (
                  <Badge tone={SEVERITY_TONE[a.severity.toUpperCase()] ?? "neutral"}>{a.severity}</Badge>
                ) : (
                  <span className="text-text-muted">Not reported</span>
                )}
              </TD>
              <TD>{a.startedAt ? formatDateTime(a.startedAt) : "—"}</TD>
              <TD>{a.endedAt ? formatDateTime(a.endedAt) : "Ongoing"}</TD>
              <TD>
                <Badge tone={a.active ? "red" : "neutral"}>{a.active ? "Active" : "Resolved"}</Badge>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </TableContainer>
  );
}

export function AlertsPageClient({ alerts }: { alerts: EnrichedAlert[] }) {
  const [q, setQ] = useState("");

  const active = alerts.filter((a) => a.active);
  const historical = alerts.filter((a) => !a.active);

  const filtered = useMemo(() => {
    if (!q.trim()) return alerts;
    const needle = q.toLowerCase();
    return alerts.filter(
      (a) =>
        (a.terminalLabel ?? "").toLowerCase().includes(needle) ||
        (a.customerName ?? "").toLowerCase().includes(needle) ||
        (a.type ?? "").toLowerCase().includes(needle) ||
        (a.message ?? "").toLowerCase().includes(needle)
    );
  }, [alerts, q]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-2xl font-bold">Alerts</p>
        <p className="text-sm text-text-muted">
          Terminal alert episodes from the SLASH API (<code className="text-xs">/alerts/user-terminals</code>).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Active Alerts" value={String(active.length)} tone="red" animatedBorder />
        <StatCard label="Resolved (Historical)" value={String(historical.length)} tone="neutral" animatedBorder />
        <StatCard label="Total Episodes" value={String(alerts.length)} tone="blue" animatedBorder />
      </div>

      <div className="max-w-sm">
        <Input
          icon={<Search className="size-4" />}
          placeholder="Search by device, customer, type..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <Tabs
        tabs={[
          { key: "active", label: `Active (${active.length})`, content: <AlertTable rows={q ? filtered.filter((a) => a.active) : active} /> },
          { key: "historical", label: `Historical (${historical.length})`, content: <AlertTable rows={q ? filtered.filter((a) => !a.active) : historical} /> },
          {
            key: "routers",
            label: "Router Alerts",
            content: (
              <EmptyState
                icon={ShieldOff}
                title="Not supported by current API"
                description="GET /alerts/routers is not confirmed against the SLASH API this app is integrated with — no router alert endpoint has been observed. This tab is wired to appear the moment that endpoint is confirmed."
              />
            ),
          },
        ]}
      />
    </div>
  );
}
