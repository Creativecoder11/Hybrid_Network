"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Wifi,
  WifiOff,
  MapPin,
  Power,
  RefreshCw,
  Ban,
  CheckCircle2,
  UploadCloud,
  Stethoscope,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { sendTerminalCommandAction } from "@/lib/actions/terminals";
import { formatDateTime, formatGB } from "@/lib/utils/format";
import type { RemoteCommandType, TerminalRecord, TerminalStatus } from "@/lib/terminals/types";

const STATUS_TONE: Record<TerminalStatus, "green" | "amber" | "red" | "neutral" | "blue"> = {
  ACTIVE: "green",
  INACTIVE: "neutral",
  DEACTIVATED: "neutral",
  SUSPENDED: "amber",
  PENDING_ACTIVATION: "blue",
  CANCELLED: "red",
};

const FAULT_SEVERITY_TONE: Record<string, "red" | "amber" | "blue" | "neutral"> = {
  CRITICAL: "red",
  MAJOR: "red",
  MINOR: "amber",
  WARNING: "amber",
};

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex items-center justify-between border-b border-line-soft py-2.5 last:border-0">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-sm font-medium text-text-primary">
        {value === null || value === undefined || value === "" ? "--" : value}
      </span>
    </div>
  );
}

function MetricTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-raised p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-text-primary">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-text-muted">{sub}</p>}
    </div>
  );
}

export function TerminalDetailClient({ terminal, canManage }: { terminal: TerminalRecord; canManage: boolean }) {
  const router = useRouter();
  const [pendingCommand, setPendingCommand] = useState<RemoteCommandType | null>(null);

  async function runCommand(command: RemoteCommandType) {
    if (command === "SUSPEND" && !confirm("Suspend this terminal's service?")) return;
    setPendingCommand(command);
    const result = await sendTerminalCommandAction(terminal.id, command);
    setPendingCommand(null);
    if (result?.error) toast.error(result.error);
    else {
      toast.success(result?.success ?? "Command sent.");
      router.refresh();
    }
  }

  const openFaults = terminal.faults.filter((f) => f.status === "OPEN");

  return (
    <div className="space-y-6">
      <Link
        href="/admin/terminals"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-primary"
      >
        <ArrowLeft className="size-3.5" />
        Back to Terminals
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xl font-bold text-text-primary">{terminal.identification.serialNumber}</p>
            <Badge tone={STATUS_TONE[terminal.status]}>{terminal.status.replace(/_/g, " ")}</Badge>
            {terminal.live.onlineStatus === "ONLINE" ? (
              <Badge tone="green">
                <Wifi className="size-3" /> Online
              </Badge>
            ) : (
              <Badge tone="neutral">
                <WifiOff className="size-3" /> Offline
              </Badge>
            )}
            {openFaults.length > 0 && <Badge tone="red">{openFaults.length} open fault{openFaults.length === 1 ? "" : "s"}</Badge>}
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {terminal.product.manufacturer} {terminal.product.model} · ICCID {terminal.identification.iccid} ·{" "}
            {terminal.activation.assignedCustomerName ? (
              <>Assigned to <span className="text-accent-green">{terminal.activation.assignedCustomerName}</span></>
            ) : (
              "Unassigned inventory"
            )}
          </p>
        </div>
      </div>

      <Tabs
        tabs={[
          {
            key: "overview",
            label: "Overview",
            content: (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                  <CardContent className="pt-5">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-accent-green">
                      Terminal Identification
                    </p>
                    <InfoRow label="Serial Number" value={terminal.identification.serialNumber} />
                    <InfoRow label="IMEI" value={terminal.identification.imei} />
                    <InfoRow label="ICCID" value={terminal.identification.iccid} />
                    <InfoRow label="Hardware ID" value={terminal.identification.hardwareId} />
                    <InfoRow label="Supplier Asset ID" value={terminal.identification.supplierAssetId} />
                    <InfoRow label="Customer Asset Reference" value={terminal.identification.customerAssetReference} />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-5">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-accent-green">
                      Product Details
                    </p>
                    <InfoRow label="Model" value={terminal.product.model} />
                    <InfoRow label="Manufacturer" value={terminal.product.manufacturer} />
                    <InfoRow label="Hardware Version" value={terminal.product.hardwareVersion} />
                    <InfoRow label="Firmware Version" value={terminal.product.firmwareVersion} />
                    <InfoRow label="Antenna Type" value={terminal.product.antennaType} />
                    <InfoRow label="Modem Type" value={terminal.product.modemType} />
                    <InfoRow label="Installed Accessories" value={terminal.product.installedAccessories.join(", ")} />
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardContent className="pt-5">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-accent-green">
                      Activation Details
                    </p>
                    <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                      <div>
                        <InfoRow label="Service Plan" value={terminal.activation.servicePlan} />
                        <InfoRow label="Assigned Customer" value={terminal.activation.assignedCustomerName} />
                        <InfoRow label="Activation Date" value={terminal.activation.activationDate ? formatDateTime(terminal.activation.activationDate) : null} />
                      </div>
                      <div>
                        <InfoRow label="Deactivation Date" value={terminal.activation.deactivationDate ? formatDateTime(terminal.activation.deactivationDate) : null} />
                        <InfoRow label="Suspension Date" value={terminal.activation.suspensionDate ? formatDateTime(terminal.activation.suspensionDate) : null} />
                        <InfoRow label="Reactivation Date" value={terminal.activation.reactivationDate ? formatDateTime(terminal.activation.reactivationDate) : null} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ),
          },
          {
            key: "live",
            label: "Live & Network",
            content: (
              <div className="space-y-4">
                <Card>
                  <CardContent className="pt-5">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-accent-green">Live Terminal Data</p>
                    <p className="mb-4 text-xs text-text-muted">
                      Refreshes every {terminal.dataRefreshRateSeconds}s · last seen {formatDateTime(terminal.live.lastSeenAt)}
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <MetricTile label="Online Status" value={terminal.live.onlineStatus} />
                      <MetricTile label="Connection State" value={terminal.live.connectionState} />
                      <MetricTile label="Signal Strength" value={`${terminal.live.signalStrengthDbm} dBm`} />
                      <MetricTile label="Signal Quality" value={`${terminal.live.signalQualityPct}%`} />
                      <MetricTile label="Data Session" value={terminal.live.dataSessionStatus} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-5">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-accent-green">Network Performance</p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <MetricTile label="Latency" value={`${terminal.network.latencyMs} ms`} />
                      <MetricTile label="Packet Loss" value={`${terminal.network.packetLossPct}%`} />
                      <MetricTile label="Uptime (30d)" value={`${terminal.network.uptimePct}%`} />
                      <MetricTile label="Downtime (30d)" value={`${terminal.network.downtimeMinutesLast30d} min`} />
                      <MetricTile label="Bandwidth" value={`${terminal.network.bandwidthMbps} Mbps`} />
                      <MetricTile label="Throughput" value={`${terminal.network.throughputMbps} Mbps`} />
                      <MetricTile label="Link Quality" value={terminal.network.linkQuality} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            ),
          },
          {
            key: "location",
            label: "Location",
            content: (
              <div className="space-y-4">
                <Card>
                  <CardContent className="pt-5">
                    <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-accent-green">
                      <MapPin className="size-3.5" /> Current GPS Location
                    </p>
                    {terminal.location ? (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <MetricTile label="Latitude" value={terminal.location.latitude.toFixed(5)} />
                        <MetricTile label="Longitude" value={terminal.location.longitude.toFixed(5)} />
                        <MetricTile label="Altitude" value={`${terminal.location.altitudeMeters} m`} />
                        <MetricTile label="Accuracy" value={`±${terminal.location.accuracyMeters} m`} />
                      </div>
                    ) : (
                      <p className="text-sm text-text-muted">No location fix — terminal not yet activated.</p>
                    )}
                  </CardContent>
                </Card>

                <div>
                  <p className="mb-3 text-sm font-semibold text-text-primary">Location History</p>
                  {terminal.locationHistory.length === 0 ? (
                    <EmptyState icon={MapPin} title="No location history" />
                  ) : (
                    <TableContainer>
                      <Table>
                        <THead>
                          <TR>
                            <TH>Timestamp</TH>
                            <TH>Latitude</TH>
                            <TH>Longitude</TH>
                            <TH>Altitude</TH>
                            <TH>Accuracy</TH>
                          </TR>
                        </THead>
                        <TBody>
                          {terminal.locationHistory.map((p) => (
                            <TR key={p.id}>
                              <TD>{formatDateTime(p.timestamp)}</TD>
                              <TD>{p.latitude.toFixed(5)}</TD>
                              <TD>{p.longitude.toFixed(5)}</TD>
                              <TD>{p.altitudeMeters} m</TD>
                              <TD>±{p.accuracyMeters} m</TD>
                            </TR>
                          ))}
                        </TBody>
                      </Table>
                    </TableContainer>
                  )}
                </div>
              </div>
            ),
          },
          {
            key: "usage",
            label: "Usage & Billing",
            content: (
              <div className="space-y-4">
                <Card>
                  <CardContent className="pt-5">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-accent-green">Usage Data</p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                      <MetricTile label="Uploaded" value={formatGB(terminal.usage.uploadBytes)} />
                      <MetricTile label="Downloaded" value={formatGB(terminal.usage.downloadBytes)} />
                      <MetricTile label="Total" value={formatGB(terminal.usage.totalBytes)} />
                      <MetricTile label="Current Session" value={formatGB(terminal.usage.sessionBytes)} />
                      <MetricTile label="Billing Period" value={formatGB(terminal.usage.billingPeriodBytes)} sub={terminal.usage.billingPeriodMonth} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-5">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-accent-green">Plan &amp; Billing Status</p>
                    <InfoRow label="Assigned Plan" value={terminal.planBilling.assignedPlan} />
                    <InfoRow
                      label="Plan Allowance"
                      value={terminal.planBilling.planAllowanceGB ? `${terminal.planBilling.planAllowanceGB} GB` : "Unlimited"}
                    />
                    <InfoRow label="Pooled Data Group" value={terminal.planBilling.pooledDataGroup} />
                    <InfoRow label="Monthly Usage" value={`${terminal.planBilling.monthlyUsageGB} GB`} />
                    <InfoRow label="Excess Usage" value={`${terminal.planBilling.excessUsageGB} GB`} />
                    <InfoRow label="Billing Status" value={terminal.planBilling.billingStatus.replace(/_/g, " ")} />
                    <InfoRow
                      label="Service Restrictions"
                      value={terminal.planBilling.serviceRestrictions.length > 0 ? terminal.planBilling.serviceRestrictions.join(", ") : "None"}
                    />
                  </CardContent>
                </Card>
              </div>
            ),
          },
          {
            key: "health",
            label: "Health",
            content: (
              <Card>
                <CardContent className="pt-5">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-accent-green">Terminal Health</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <MetricTile label="Power Status" value={terminal.health.powerStatus} />
                    <MetricTile label="Temperature" value={`${terminal.health.temperatureCelsius}°C`} />
                    <MetricTile label="Voltage" value={`${terminal.health.voltage} V`} />
                    <MetricTile label="Antenna Alignment" value={terminal.health.antennaAlignment} />
                    <MetricTile label="Modem Status" value={terminal.health.modemStatus} />
                    <MetricTile label="SIM Status" value={terminal.health.simStatus.replace(/_/g, " ")} />
                    <MetricTile label="Firmware Status" value={terminal.health.firmwareStatus.replace(/_/g, " ")} />
                  </div>
                </CardContent>
              </Card>
            ),
          },
          {
            key: "faults",
            label: "Faults & Alarms",
            content: (
              <div className="space-y-4">
                <div>
                  <p className="mb-3 text-sm font-semibold text-text-primary">Faults</p>
                  {terminal.faults.length === 0 ? (
                    <EmptyState title="No faults reported" />
                  ) : (
                    <TableContainer>
                      <Table>
                        <THead>
                          <TR>
                            <TH>Code</TH>
                            <TH>Description</TH>
                            <TH>Severity</TH>
                            <TH>Started</TH>
                            <TH>Cleared</TH>
                            <TH>Status</TH>
                          </TR>
                        </THead>
                        <TBody>
                          {terminal.faults.map((f) => (
                            <TR key={f.id}>
                              <TD className="font-mono text-xs">{f.code}</TD>
                              <TD>{f.description}</TD>
                              <TD>
                                <Badge tone={FAULT_SEVERITY_TONE[f.severity] ?? "neutral"}>{f.severity}</Badge>
                              </TD>
                              <TD>{formatDateTime(f.startTime)}</TD>
                              <TD>{f.clearTime ? formatDateTime(f.clearTime) : "--"}</TD>
                              <TD>
                                <Badge tone={f.status === "OPEN" ? "red" : f.status === "ACKNOWLEDGED" ? "amber" : "green"}>
                                  {f.status}
                                </Badge>
                              </TD>
                            </TR>
                          ))}
                        </TBody>
                      </Table>
                    </TableContainer>
                  )}
                </div>

                <div>
                  <p className="mb-3 text-sm font-semibold text-text-primary">Alarms</p>
                  {terminal.alarms.length === 0 ? (
                    <EmptyState title="No active alarms" />
                  ) : (
                    <div className="space-y-2">
                      {terminal.alarms.map((a) => (
                        <div key={a.id} className="flex items-center justify-between rounded-xl border border-line bg-surface p-3.5">
                          <div>
                            <p className="text-sm text-text-primary">{a.message}</p>
                            <p className="text-xs text-text-muted">
                              {a.type.replace(/_/g, " ")} · {formatDateTime(a.triggeredAt)}
                            </p>
                          </div>
                          <Badge tone={a.acknowledged ? "neutral" : "red"}>
                            {a.acknowledged ? "Acknowledged" : "Unacknowledged"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ),
          },
          {
            key: "audit",
            label: "Audit History",
            content:
              terminal.auditHistory.length === 0 ? (
                <EmptyState title="No audit history" />
              ) : (
                <div className="space-y-2">
                  {terminal.auditHistory.map((a) => (
                    <div key={a.id} className="flex items-start justify-between gap-4 rounded-xl border border-line bg-surface p-3.5 text-sm">
                      <div>
                        <p className="font-medium text-text-primary">{a.action}</p>
                        <p className="text-xs text-text-muted">{a.details}</p>
                        <p className="mt-1 text-xs text-text-muted">by {a.actor}</p>
                      </div>
                      <span className="whitespace-nowrap text-xs text-text-muted">{formatDateTime(a.timestamp)}</span>
                    </div>
                  ))}
                </div>
              ),
          },
          ...(canManage
            ? [
                {
                  key: "actions",
                  label: "Remote Commands",
                  content: (
                    <div className="max-w-sm space-y-3">
                      <p className="mb-1 text-xs text-text-muted">
                        Authorised actions sent to the terminal. Logged to the activity trail.
                      </p>
                      <ActionButton
                        icon={RefreshCw}
                        label="Reboot Terminal"
                        pending={pendingCommand === "REBOOT"}
                        onClick={() => runCommand("REBOOT")}
                      />
                      <ActionButton
                        icon={RefreshCw}
                        label="Refresh Service"
                        pending={pendingCommand === "REFRESH_SERVICE"}
                        onClick={() => runCommand("REFRESH_SERVICE")}
                      />
                      {terminal.status !== "SUSPENDED" ? (
                        <ActionButton
                          icon={Ban}
                          label="Suspend Service"
                          pending={pendingCommand === "SUSPEND"}
                          onClick={() => runCommand("SUSPEND")}
                        />
                      ) : (
                        <ActionButton
                          icon={CheckCircle2}
                          label="Reactivate Service"
                          pending={pendingCommand === "REACTIVATE"}
                          onClick={() => runCommand("REACTIVATE")}
                        />
                      )}
                      <ActionButton
                        icon={UploadCloud}
                        label="Update Firmware"
                        pending={pendingCommand === "UPDATE_FIRMWARE"}
                        onClick={() => runCommand("UPDATE_FIRMWARE")}
                      />
                      <ActionButton
                        icon={Stethoscope}
                        label="Request Diagnostics"
                        pending={pendingCommand === "REQUEST_DIAGNOSTICS"}
                        onClick={() => runCommand("REQUEST_DIAGNOSTICS")}
                      />
                    </div>
                  ),
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  pending,
}: {
  icon: typeof Power;
  label: string;
  onClick: () => void;
  pending?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className="flex w-full items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised disabled:opacity-50"
    >
      <Icon className="size-4" />
      {pending ? "Sending…" : label}
    </button>
  );
}
