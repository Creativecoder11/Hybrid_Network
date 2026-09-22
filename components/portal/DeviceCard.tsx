import Link from "next/link";
import { MapPin, AlertTriangle, ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LabeledProgress } from "@/components/ui/ProgressBar";
import { TerminalStatusDot } from "@/components/portal/TerminalStatusDot";
import { formatDateTime, formatGB } from "@/lib/utils/format";
import { fmtMbps, fmtMs, fmtPct, fmtText, fmtUptime } from "@/lib/utils/telemetry";
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

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-raised p-3.5" title={hint}>
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-text-primary">{value}</p>
    </div>
  );
}

export function DeviceCard({ terminal, showLocation }: { terminal: TerminalRecord; showLocation: boolean }) {
  const openFaults = terminal.faults.filter((f) => f.status === "OPEN");
  const usedGB = terminal.planBilling.monthlyUsageGB;
  const allowanceGB = terminal.planBilling.planAllowanceGB;
  const online = terminal.live.onlineStatus === "ONLINE";
  const name = terminal.activation.displayName || terminal.product.model;

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="text-base font-semibold text-text-primary">{name}</p>
              <TerminalStatusDot status={terminal.live.onlineStatus} />
            </div>
            <p className="mt-1 text-xs text-text-muted">
              Kit {terminal.identification.serialNumber}
              {terminal.identification.hardwareId ? ` · Dish ${terminal.identification.hardwareId}` : ""}
              {terminal.activation.serviceLineNumber ? ` · Line ${terminal.activation.serviceLineNumber}` : ""}
            </p>
            <p className="mt-0.5 text-xs text-text-muted">{terminal.live.statusReason}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={STATUS_TONE[terminal.status]}>{SERVICE_LABEL[terminal.status]}</Badge>
            <Link
              href={`/portal/devices/${encodeURIComponent(terminal.id)}`}
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-raised"
            >
              View Details
            </Link>
          </div>
        </div>

        {openFaults.length > 0 && (
          <div className="mt-4 space-y-1.5 rounded-xl border border-red/30 bg-red/10 p-3.5">
            {openFaults.map((f) => (
              <div key={f.id} className="flex items-center gap-2 text-xs text-red">
                <AlertTriangle className="size-3.5 shrink-0" />
                {f.description}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Tile label="Signal Quality" value={online ? fmtPct(terminal.live.signalQualityPct) : "--"} />
          <Tile
            label="Throughput"
            value={
              online && (terminal.network.downlinkThroughputMbps !== null || terminal.network.uplinkThroughputMbps !== null)
                ? `↓ ${fmtMbps(terminal.network.downlinkThroughputMbps)} · ↑ ${fmtMbps(terminal.network.uplinkThroughputMbps)}`
                : online
                  ? "Not available"
                  : "--"
            }
            hint={terminal.network.measuredAt ? `Measured ${formatDateTime(terminal.network.measuredAt)}` : undefined}
          />
          <Tile label="Latency" value={online ? fmtMs(terminal.network.latencyMs) : "--"} />
          <Tile label="Firmware" value={fmtText(terminal.product.firmwareVersion)} />
          <Tile label="Uptime" value={online ? fmtUptime(terminal.network.uptimeSeconds) : "--"} />
          <Tile label="Last Seen" value={terminal.live.lastSeenAt ? formatDateTime(terminal.live.lastSeenAt) : "Never"} />
        </div>

        <div className="mt-4">
          <LabeledProgress
            label="Service line data this cycle"
            value={usedGB}
            max={allowanceGB ?? Math.max(1, usedGB)}
            displayValue={allowanceGB ? `${formatGB(usedGB * 1e9)} / ${allowanceGB} GB` : formatGB(usedGB * 1e9)}
            tone={allowanceGB && usedGB > allowanceGB ? "red" : "green"}
          />
        </div>

        {showLocation && (
          <div className="mt-4 flex items-center gap-2 text-xs text-text-secondary">
            <MapPin className="size-3.5 text-accent-green" />
            {terminal.location ? (
              <>
                {terminal.location.latitude.toFixed(4)}, {terminal.location.longitude.toFixed(4)} · updated{" "}
                {formatDateTime(terminal.location.timestamp)}
              </>
            ) : (
              <span className="text-text-muted">No GPS location reported yet</span>
            )}
          </div>
        )}

        {online && (terminal.network.downlinkThroughputMbps !== null || terminal.network.uplinkThroughputMbps !== null) && (
          <p className="mt-3 flex items-center gap-3 text-[11px] text-text-muted">
            <span className="flex items-center gap-1"><ArrowDown className="size-3" /> downlink</span>
            <span className="flex items-center gap-1"><ArrowUp className="size-3" /> uplink</span>
            {terminal.network.measuredAt && <span>· measured {formatDateTime(terminal.network.measuredAt)}</span>}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
