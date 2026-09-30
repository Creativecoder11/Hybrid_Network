"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, EyeOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { LocationMap } from "@/components/ui/LocationMap";
import { FreshnessIndicator } from "@/components/ui/FreshnessIndicator";
import { TerminalStatusDot } from "@/components/portal/TerminalStatusDot";
import { usePolling } from "@/lib/hooks/usePolling";
import { formatDateTime, formatGB } from "@/lib/utils/format";
import { fmtMbps, fmtMs, fmtPct, fmtText, fmtUptime, NOT_AVAILABLE } from "@/lib/utils/telemetry";
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

const SERVICE_LABEL: Record<TerminalStatus, string> = {
  ACTIVE: "Service active",
  INACTIVE: "Terminal inactive",
  DEACTIVATED: "Deactivated",
  SUSPENDED: "Service line inactive",
  PENDING_ACTIVATION: "Pending activation",
  CANCELLED: "Cancelled",
};

function MetricTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-raised p-4" title={hint}>
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${value === NOT_AVAILABLE ? "text-text-muted" : "text-text-primary"}`}>{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line-soft py-2.5 last:border-0">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-right text-sm font-medium text-text-primary">{value === null || value === undefined || value === "" ? "--" : value}</span>
    </div>
  );
}

export function DeviceDetailClient({
  terminal,
  alerts,
  locationEnabled,
}: {
  terminal: TerminalRecord;
  alerts: EnrichedAlert[];
  locationEnabled: boolean;
}) {
  const router = useRouter();
  usePolling(() => router.refresh(), 45_000, !!terminal.sourceVesselId);
  const online = terminal.live.onlineStatus === "ONLINE";
  const live = (v: string) => (online ? v : "--");
  const name = terminal.activation.displayName || terminal.identification.serialNumber;

  return (
    <div className="space-y-6">
      <Link href="/portal/devices" className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-primary">
        <ArrowLeft className="size-3.5" />
        Back to My Devices
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xl font-bold text-text-primary">{name}</p>
          <TerminalStatusDot status={terminal.live.onlineStatus} />
          <Badge tone={STATUS_TONE[terminal.status]}>{SERVICE_LABEL[terminal.status]}</Badge>
          {terminal.live.lastSeenAt && <FreshnessIndicator lastSeenAt={terminal.live.lastSeenAt} />}
        </div>
        <p className="mt-1 text-sm text-text-muted">
          {terminal.product.manufacturer} {terminal.product.model} · {terminal.live.statusReason}
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
                      <MetricTile
                        label="Online Status"
                        value={terminal.live.onlineStatus === "UNKNOWN" ? "Unknown" : terminal.live.onlineStatus === "ONLINE" ? "Online" : "Offline"}
                        hint={terminal.live.statusReason}
                      />
                      <MetricTile
                        label="Last Telemetry"
                        value={terminal.live.lastSeenAt ? formatDateTime(terminal.live.lastSeenAt) : "Never"}
                      />
                      <MetricTile label="Signal Quality" value={live(fmtPct(terminal.live.signalQualityPct))} />
                      <MetricTile label="Firmware" value={fmtText(terminal.product.firmwareVersion)} />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5">
                    <p className="mb-1 text-xs font-bold uppercase tracking-wider text-accent-green">Network Performance</p>
                    <p className="mb-3 text-xs text-text-muted">
                      {online
                        ? terminal.network.measuredAt
                          ? `Latest reading from Starlink telemetry, ${formatDateTime(terminal.network.measuredAt)}.`
                          : "Latest reading from Starlink telemetry."
                        : "Live performance is shown while the terminal is online."}
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <MetricTile label="Download Throughput" value={live(fmtMbps(terminal.network.downlinkThroughputMbps))} />
                      <MetricTile label="Upload Throughput" value={live(fmtMbps(terminal.network.uplinkThroughputMbps))} />
                      <MetricTile label="Latency (avg ping)" value={live(fmtMs(terminal.network.latencyMs))} />
                      <MetricTile label="Ping Drop Rate" value={live(fmtPct(terminal.network.packetLossPct, 2))} />
                      <MetricTile label="Obstruction" value={live(fmtPct(terminal.network.obstructionPct, 1))} />
                      <MetricTile label="Uptime (since reboot)" value={live(fmtUptime(terminal.network.uptimeSeconds))} />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-accent-green">Device</p>
                    <InfoRow label="Kit serial number" value={terminal.identification.serialNumber} />
                    <InfoRow label="Dish serial number" value={terminal.identification.hardwareId} />
                    <InfoRow label="Service line" value={terminal.activation.serviceLineNumber} />
                    <InfoRow label="Customer account" value={terminal.activation.assignedAccountNumber} />
                    <InfoRow label="Firmware version" value={fmtText(terminal.product.firmwareVersion)} />
                  </CardContent>
                </Card>
              </div>
            ),
          },
          {
            key: "location",
            label: "Location",
            content: !locationEnabled ? (
              <EmptyState
                icon={EyeOff}
                title="Location is not available"
                description="Device location visibility has been disabled by your administrator."
              />
            ) : terminal.location ? (
              <div className="space-y-4">
                <LocationMap
                  points={[{ id: terminal.id, latitude: terminal.location.latitude, longitude: terminal.location.longitude, label: name }]}
                  trail={terminal.locationHistory}
                />
                <p className="text-xs text-text-muted">
                  {terminal.location.latitude.toFixed(5)}, {terminal.location.longitude.toFixed(5)} · reported by Starlink{" "}
                  {formatDateTime(terminal.location.timestamp)}
                </p>
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
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-accent-green">Service line usage this cycle</p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <MetricTile label="Total" value={formatGB(terminal.usage.billingPeriodBytes)} />
                      <MetricTile
                        label="Priority"
                        value={terminal.usage.priorityBytes !== undefined ? formatGB(terminal.usage.priorityBytes) : NOT_AVAILABLE}
                      />
                      <MetricTile
                        label="Standard"
                        value={terminal.usage.standardBytes !== undefined ? formatGB(terminal.usage.standardBytes) : NOT_AVAILABLE}
                      />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-accent-green">Service Plan</p>
                    <InfoRow label="Plan" value={terminal.planBilling.assignedPlan} />
                    <InfoRow
                      label="Allowance"
                      value={terminal.planBilling.planAllowanceGB !== null ? `${terminal.planBilling.planAllowanceGB} GB` : NOT_AVAILABLE}
                    />
                    <InfoRow label="Used this cycle" value={`${terminal.planBilling.monthlyUsageGB} GB`} />
                    {terminal.planBilling.serviceRestrictions.map((r) => (
                      <InfoRow key={r} label="Restriction" value={r} />
                    ))}
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
                <EmptyState title="No alerts" description="No alert episodes recorded for this device in the last 7 days." />
              ) : (
                <div className="space-y-2">
                  {alerts.map((a) => (
                    <div key={a.id} className="flex items-start justify-between gap-4 rounded-xl border border-line bg-surface p-3.5 text-sm">
                      <div>
                        <p className="font-medium text-text-primary">{a.alertName}</p>
                        {a.description && <p className="text-xs text-text-muted">{a.description}</p>}
                        <p className="mt-1 text-xs text-text-muted">
                          {a.firstSeen ? formatDateTime(a.firstSeen) : "—"} {a.lastSeen ? `→ ${formatDateTime(a.lastSeen)}` : ""}
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
