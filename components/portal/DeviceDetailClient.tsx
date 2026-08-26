"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Wifi, WifiOff, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { LocationMap } from "@/components/ui/LocationMap";
import { FreshnessIndicator } from "@/components/ui/FreshnessIndicator";
import { usePolling } from "@/lib/hooks/usePolling";
import { formatDateTime, formatGB } from "@/lib/utils/format";
import type { EnrichedAlert } from "@/lib/terminals/alerts";
import type { TerminalRecord, TerminalStatus } from "@/lib/terminals/types";

const STATUS_TONE: Record<TerminalStatus, "green" | "amber" | "red" | "neutral" | "blue"> = {
  ACTIVE: "green",
  INACTIVE: "neutral",
  DEACTIVATED: "neutral",
  SUSPENDED: "amber",
  PENDING_ACTIVATION: "blue",
  CANCELLED: "red",
};

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-raised p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex items-center justify-between border-b border-line-soft py-2.5 last:border-0">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-sm font-medium text-text-primary">{value === null || value === undefined || value === "" ? "--" : value}</span>
    </div>
  );
}

export function DeviceDetailClient({ terminal, alerts }: { terminal: TerminalRecord; alerts: EnrichedAlert[] }) {
  const router = useRouter();
  usePolling(() => router.refresh(), 45_000, !!terminal.sourceVesselId);

  return (
    <div className="space-y-6">
      <Link href="/portal/devices" className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-primary">
        <ArrowLeft className="size-3.5" />
        Back to My Devices
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xl font-bold text-text-primary">{terminal.identification.serialNumber}</p>
          <Badge tone={STATUS_TONE[terminal.status]}>{terminal.status.replace(/_/g, " ")}</Badge>
          {terminal.live.onlineStatus === "ONLINE" ? (
            <Badge tone="green"><Wifi className="size-3" /> Online</Badge>
          ) : (
            <Badge tone="neutral"><WifiOff className="size-3" /> Offline</Badge>
          )}
          <FreshnessIndicator lastSeenAt={terminal.live.lastSeenAt} />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          {terminal.product.manufacturer} {terminal.product.model}
        </p>
      </div>

      <Tabs
        tabs={[
          {
            key: "status",
            label: "Status & Connectivity",
            content: (
              <div className="space-y-4">
                <Card>
                  <CardContent className="pt-5">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-accent-green">Live Status</p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <MetricTile label="Online Status" value={terminal.live.onlineStatus} />
                      <MetricTile label="Connection" value={terminal.live.connectionState} />
                      <MetricTile label="Signal Quality" value={`${terminal.live.signalQualityPct}%`} />
                      <MetricTile label="Link Quality" value={terminal.network.linkQuality} />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5">
                    <p className="mb-1 text-xs font-bold uppercase tracking-wider text-accent-green">Network Performance</p>
                    {terminal.sourceVesselId && (
                      <p className="mb-3 text-xs text-text-muted">Not returned by the provider for this device yet.</p>
                    )}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <MetricTile label="Latency" value={`${terminal.network.latencyMs} ms`} />
                      <MetricTile label="Packet Loss" value={`${terminal.network.packetLossPct}%`} />
                      <MetricTile label="Uptime (30d)" value={`${terminal.network.uptimePct}%`} />
                      <MetricTile label="Throughput" value={`${terminal.network.throughputMbps} Mbps`} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            ),
          },
          {
            key: "location",
            label: "Location",
            content: terminal.location ? (
              <div className="space-y-4">
                <LocationMap
                  points={[{ id: terminal.id, latitude: terminal.location.latitude, longitude: terminal.location.longitude, label: terminal.identification.serialNumber }]}
                  trail={terminal.locationHistory}
                />
                <p className="text-xs text-text-muted">Updated {formatDateTime(terminal.location.timestamp)}</p>
              </div>
            ) : (
              <EmptyState icon={MapPin} title="No location fix" description="This device hasn't reported a GPS location yet." />
            ),
          },
          {
            key: "usage",
            label: "Usage & Plan",
            content: (
              <div className="space-y-4">
                <Card>
                  <CardContent className="pt-5">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-accent-green">Data Usage</p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <MetricTile label="Total Used" value={formatGB(terminal.usage.totalBytes)} />
                      <MetricTile label="Billing Period" value={formatGB(terminal.usage.billingPeriodBytes)} />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-accent-green">Service Plan</p>
                    <InfoRow label="Plan" value={terminal.planBilling.assignedPlan} />
                    <InfoRow label="Allowance" value={terminal.planBilling.planAllowanceGB ? `${terminal.planBilling.planAllowanceGB} GB` : "Unlimited"} />
                    <InfoRow label="Used This Cycle" value={`${terminal.planBilling.monthlyUsageGB} GB`} />
                    <InfoRow label="Billing Status" value={terminal.planBilling.billingStatus.replace(/_/g, " ")} />
                  </CardContent>
                </Card>
              </div>
            ),
          },
          {
            key: "alerts",
            label: `Alerts${alerts.length > 0 ? ` (${alerts.length})` : ""}`,
            content:
              alerts.length === 0 ? (
                <EmptyState title="No alerts" description="No alert episodes recorded for this device." />
              ) : (
                <div className="space-y-2">
                  {alerts.map((a, i) => (
                    <div key={a.id ?? i} className="flex items-start justify-between gap-4 rounded-xl border border-line bg-surface p-3.5 text-sm">
                      <div>
                        <p className="font-medium text-text-primary">{a.type ?? "Alert"}</p>
                        <p className="text-xs text-text-muted">{a.message ?? "No message reported."}</p>
                        <p className="mt-1 text-xs text-text-muted">
                          {a.startedAt ? formatDateTime(a.startedAt) : "—"} {a.endedAt ? `→ ${formatDateTime(a.endedAt)}` : ""}
                        </p>
                      </div>
                      <Badge tone={a.active ? "red" : "neutral"}>{a.active ? "Active" : "Resolved"}</Badge>
                    </div>
                  ))}
                </div>
              ),
          },
        ]}
      />
    </div>
  );
}
