import "server-only";
import type { TerminalRecord } from "./types";

// App-computed fleet aggregates (§6, §14, §12) — there is no confirmed
// /analytics/fleet/* endpoint on the SLASH API (see
// docs/slash-api-integration-plan.md), so these are derived here from the
// already-fetched per-terminal records rather than from a provider
// analytics endpoint. Explicitly labeled as app-computed everywhere they're
// rendered.
export type FleetOverviewStats = {
  total: number;
  active: number;
  online: number;
  offline: number;
  suspended: number;
  activeServices: number;
  connectivity: {
    avgLatencyMs: number;
    avgSignalQualityPct: number;
    avgThroughputMbps: number;
    avgUptimePct: number;
    activeCount: number;
    inactiveCount: number;
  };
  usage: {
    totalGB: number;
    priorityGB: number;
    standardGB: number;
    avgDailyGB: number;
  };
};

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function computeFleetOverview(terminals: TerminalRecord[]): FleetOverviewStats {
  const total = terminals.length;
  const online = terminals.filter((t) => t.live.onlineStatus === "ONLINE").length;
  const active = terminals.filter((t) => t.status === "ACTIVE").length;
  const suspended = terminals.filter((t) => t.status === "SUSPENDED").length;
  const activeServices = terminals.filter((t) => t.status === "ACTIVE" && t.planBilling.billingStatus === "CURRENT").length;

  const connectivity = {
    avgLatencyMs: Math.round(avg(terminals.map((t) => t.network.latencyMs))),
    avgSignalQualityPct: Math.round(avg(terminals.map((t) => t.live.signalQualityPct))),
    avgThroughputMbps: Math.round(avg(terminals.map((t) => t.network.throughputMbps)) * 10) / 10,
    avgUptimePct: Math.round(avg(terminals.map((t) => t.network.uptimePct)) * 10) / 10,
    activeCount: active,
    inactiveCount: total - active,
  };

  const totalGB = terminals.reduce((s, t) => s + t.usage.totalBytes / 1e9, 0);
  const priorityGB = terminals.reduce((s, t) => s + (t.usage.priorityBytes ?? 0) / 1e9, 0);
  const standardGB = terminals.reduce((s, t) => s + (t.usage.standardBytes ?? 0) / 1e9, 0);
  const dayOfMonth = new Date().getDate();
  const avgDailyGB = dayOfMonth > 0 ? totalGB / dayOfMonth : 0;

  return {
    total,
    active,
    online,
    offline: total - online,
    suspended,
    activeServices,
    connectivity,
    usage: {
      totalGB: Math.round(totalGB * 100) / 100,
      priorityGB: Math.round(priorityGB * 100) / 100,
      standardGB: Math.round(standardGB * 100) / 100,
      avgDailyGB: Math.round(avgDailyGB * 100) / 100,
    },
  };
}
