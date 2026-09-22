import "server-only";
import type { TerminalRecord } from "./types";

// App-computed fleet aggregates, derived from the already-fetched
// per-terminal records (one telemetry call for the fleet) and labeled as
// app-computed wherever they're rendered. Averages only include terminals
// that actually reported the metric (and, for live readings, are online);
// null means no terminal reported it.
export type FleetOverviewStats = {
  total: number;
  active: number;
  online: number;
  offline: number;
  suspended: number;
  activeServices: number;
  connectivity: {
    avgLatencyMs: number | null;
    avgSignalQualityPct: number | null;
    avgThroughputMbps: number | null;
    avgUptimePct: number | null;
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

function avg(values: (number | null)[], decimals = 0): number | null {
  const real = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (real.length === 0) return null;
  const f = 10 ** decimals;
  return Math.round((real.reduce((a, b) => a + b, 0) / real.length) * f) / f;
}

export function computeFleetOverview(terminals: TerminalRecord[]): FleetOverviewStats {
  const total = terminals.length;
  const online = terminals.filter((t) => t.live.onlineStatus === "ONLINE").length;
  const active = terminals.filter((t) => t.status === "ACTIVE").length;
  const suspended = terminals.filter((t) => t.status === "SUSPENDED").length;
  const activeServices = terminals.filter((t) => t.status === "ACTIVE" && t.planBilling.billingStatus === "CURRENT").length;

  const onlineTerminals = terminals.filter((t) => t.live.onlineStatus === "ONLINE");
  const connectivity = {
    avgLatencyMs: avg(onlineTerminals.map((t) => t.network.latencyMs)),
    avgSignalQualityPct: avg(onlineTerminals.map((t) => t.live.signalQualityPct)),
    avgThroughputMbps: avg(onlineTerminals.map((t) => t.network.throughputMbps), 1),
    avgUptimePct: avg(terminals.map((t) => t.network.uptimePct), 1),
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
