"use client";

import { Info } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { LabeledProgress } from "@/components/ui/ProgressBar";
import type { TerminalRecord, TerminalStatus, LinkQuality } from "@/lib/terminals/types";
import type { FleetOverviewStats } from "@/lib/terminals/fleetStats";

const STATUS_LABELS: Record<TerminalStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  DEACTIVATED: "Deactivated",
  SUSPENDED: "Suspended",
  PENDING_ACTIVATION: "Pending Activation",
  CANCELLED: "Cancelled",
};

const LINK_QUALITY_ORDER: LinkQuality[] = ["EXCELLENT", "GOOD", "FAIR", "POOR"];
const LINK_QUALITY_TONE: Record<LinkQuality, "green" | "blue" | "amber" | "red"> = {
  EXCELLENT: "green",
  GOOD: "blue",
  FAIR: "amber",
  POOR: "red",
};

function countBy<T extends string>(items: T[]): Map<T, number> {
  const map = new Map<T, number>();
  for (const item of items) map.set(item, (map.get(item) ?? 0) + 1);
  return map;
}

export function AnalyticsPageClient({ terminals, fleet }: { terminals: TerminalRecord[]; fleet: FleetOverviewStats }) {
  const statusCounts = countBy(terminals.map((t) => t.status));
  const linkQualityCounts = countBy(terminals.map((t) => t.network.linkQuality));
  const onlineRate = fleet.total > 0 ? Math.round((fleet.online / fleet.total) * 100) : 0;
  const maxStatusCount = Math.max(1, ...[...statusCounts.values()]);
  const maxLinkQualityCount = Math.max(1, ...[...linkQualityCounts.values()]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-2xl font-bold">Fleet Analytics</p>
        <div className="mt-1 flex items-start gap-1.5 text-xs text-text-muted">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Computed by this app from the terminal records it already fetches. The SLASH API&apos;s
            <code className="mx-1">/analytics/fleet/*</code>
            endpoints referenced in the spec are not confirmed to exist — see docs/slash-api-integration-plan.md.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Fleet Online Rate" value={`${onlineRate}%`} tone="green" animatedBorder />
        <StatCard label="Active Services" value={String(fleet.activeServices)} tone="blue" animatedBorder />
        <StatCard label="Avg Uptime" value={`${fleet.connectivity.avgUptimePct}%`} tone="purple" animatedBorder />
        <StatCard label="Avg Throughput" value={`${fleet.connectivity.avgThroughputMbps} Mbps`} tone="amber" animatedBorder />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm font-semibold text-text-primary">Status Distribution</p>
          <p className="mb-4 text-xs text-text-muted">Terminals by current status</p>
          <div className="space-y-4">
            {(Object.keys(STATUS_LABELS) as TerminalStatus[])
              .filter((s) => (statusCounts.get(s) ?? 0) > 0)
              .map((s) => (
                <LabeledProgress
                  key={s}
                  label={STATUS_LABELS[s]}
                  value={statusCounts.get(s) ?? 0}
                  max={maxStatusCount}
                  displayValue={String(statusCounts.get(s) ?? 0)}
                  tone="blue"
                />
              ))}
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold text-text-primary">Link Quality Distribution</p>
          <p className="mb-4 text-xs text-text-muted">Terminals by reported link quality</p>
          <div className="space-y-4">
            {LINK_QUALITY_ORDER.filter((q) => (linkQualityCounts.get(q) ?? 0) > 0).map((q) => (
              <LabeledProgress
                key={q}
                label={q.charAt(0) + q.slice(1).toLowerCase()}
                value={linkQualityCounts.get(q) ?? 0}
                max={maxLinkQualityCount}
                displayValue={String(linkQualityCounts.get(q) ?? 0)}
                tone={LINK_QUALITY_TONE[q]}
              />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
