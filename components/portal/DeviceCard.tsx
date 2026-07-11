import { Wifi, WifiOff, MapPin, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LabeledProgress } from "@/components/ui/ProgressBar";
import { formatDateTime, formatGB } from "@/lib/utils/format";
import type { TerminalRecord, TerminalStatus } from "@/lib/terminals/types";

const STATUS_TONE: Record<TerminalStatus, "green" | "amber" | "red" | "neutral" | "blue"> = {
  ACTIVE: "green",
  INACTIVE: "neutral",
  DEACTIVATED: "neutral",
  SUSPENDED: "amber",
  PENDING_ACTIVATION: "blue",
  CANCELLED: "red",
};

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-raised p-3.5">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-text-primary">{value}</p>
    </div>
  );
}

export function DeviceCard({ terminal }: { terminal: TerminalRecord }) {
  const openFaults = terminal.faults.filter((f) => f.status === "OPEN");
  const usedGB = terminal.planBilling.monthlyUsageGB;
  const allowanceGB = terminal.planBilling.planAllowanceGB;

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-semibold text-text-primary">{terminal.product.model}</h3>
              <Badge tone={STATUS_TONE[terminal.status]}>{terminal.status.replace(/_/g, " ")}</Badge>
            </div>
            <p className="mt-1 text-xs text-text-muted">
              {terminal.product.manufacturer} · Serial {terminal.identification.serialNumber} · ICCID{" "}
              {terminal.identification.iccid}
            </p>
          </div>
          {terminal.live.onlineStatus === "ONLINE" ? (
            <Badge tone="green">
              <Wifi className="size-3" /> Online
            </Badge>
          ) : (
            <Badge tone="neutral">
              <WifiOff className="size-3" /> Offline
            </Badge>
          )}
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

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Signal" value={terminal.live.onlineStatus === "ONLINE" ? `${terminal.live.signalStrengthDbm} dBm` : "--"} />
          <Tile label="Signal Quality" value={terminal.live.onlineStatus === "ONLINE" ? `${terminal.live.signalQualityPct}%` : "--"} />
          <Tile label="Link Quality" value={terminal.network.linkQuality} />
          <Tile label="Last Seen" value={formatDateTime(terminal.live.lastSeenAt)} />
        </div>

        <div className="mt-4">
          <LabeledProgress
            label="Data Used This Period"
            value={usedGB}
            max={allowanceGB ?? Math.max(1, usedGB)}
            displayValue={allowanceGB ? `${formatGB(usedGB * 1e9)} / ${allowanceGB} GB` : `${formatGB(usedGB * 1e9)} · Unlimited`}
            tone={allowanceGB && usedGB > allowanceGB ? "red" : "green"}
          />
        </div>

        {terminal.location && (
          <div className="mt-4 flex items-center gap-2 text-xs text-text-secondary">
            <MapPin className="size-3.5 text-accent-green" />
            {terminal.location.latitude.toFixed(4)}, {terminal.location.longitude.toFixed(4)} · updated{" "}
            {formatDateTime(terminal.location.timestamp)}
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-xs text-text-secondary">
          <div>
            <p className="text-text-muted">Power</p>
            <p className="mt-0.5 font-medium text-text-primary">{terminal.health.powerStatus}</p>
          </div>
          <div>
            <p className="text-text-muted">SIM</p>
            <p className="mt-0.5 font-medium text-text-primary">{terminal.health.simStatus.replace(/_/g, " ")}</p>
          </div>
          <div>
            <p className="text-text-muted">Firmware</p>
            <p className="mt-0.5 font-medium text-text-primary">{terminal.health.firmwareStatus.replace(/_/g, " ")}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
