"use client";

import { AlertTriangle } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
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

export function PortalAlertsClient({ alerts }: { alerts: EnrichedAlert[] }) {
  const active = alerts.filter((a) => a.active);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xl font-bold text-text-primary">Alerts</p>
        <p className="text-sm text-text-muted">Alert episodes reported for your devices.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Active Alerts" value={String(active.length)} tone="red" animatedBorder />
        <StatCard label="Total Episodes" value={String(alerts.length)} tone="blue" animatedBorder />
      </div>

      {alerts.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No alerts" description="No alert episodes recorded for your devices." />
      ) : (
        <TableContainer>
          <Table>
            <THead>
              <TR>
                <TH>Device</TH>
                <TH>Type</TH>
                <TH>Message</TH>
                <TH>Severity</TH>
                <TH>First Seen</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {alerts.map((a, i) => (
                <TR key={a.id ?? i}>
                  <TD className="font-medium text-text-primary">{a.terminalLabel ?? "Unknown device"}</TD>
                  <TD>{a.type ?? "—"}</TD>
                  <TD className="max-w-xs truncate">{a.message ?? "—"}</TD>
                  <TD>{a.severity ? <Badge tone={SEVERITY_TONE[a.severity.toUpperCase()] ?? "neutral"}>{a.severity}</Badge> : <span className="text-text-muted">Not reported</span>}</TD>
                  <TD>{a.startedAt ? formatDateTime(a.startedAt) : "—"}</TD>
                  <TD><Badge tone={a.active ? "red" : "neutral"}>{a.active ? "Active" : "Resolved"}</Badge></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}
