"use client";

import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Download } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatGB } from "@/lib/utils/format";
import type { TerminalRecord } from "@/lib/terminals/types";
import type { FleetOverviewStats } from "@/lib/terminals/fleetStats";

export function UsagePageClient({ terminals, fleet }: { terminals: TerminalRecord[]; fleet: FleetOverviewStats }) {
  const chartData = [...terminals]
    .sort((a, b) => b.planBilling.monthlyUsageGB - a.planBilling.monthlyUsageGB)
    .slice(0, 10)
    .map((t) => ({ name: t.identification.serialNumber, gb: Math.round(t.planBilling.monthlyUsageGB * 10) / 10 }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-2xl font-bold">Fleet Usage</p>
          <p className="text-sm text-text-muted">Data usage across every terminal, current billing period.</p>
        </div>
        <a href="/api/admin/reports/export?type=usage&format=csv">
          <button className="flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-xs font-medium text-text-secondary hover:bg-surface-raised">
            <Download className="size-3.5" /> Export CSV
          </button>
        </a>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Usage" value={`${fleet.usage.totalGB.toFixed(1)} GB`} tone="blue" animatedBorder />
        <StatCard label="Priority Data" value={`${fleet.usage.priorityGB.toFixed(1)} GB`} tone="green" animatedBorder />
        <StatCard label="Standard Data" value={`${fleet.usage.standardGB.toFixed(1)} GB`} tone="purple" animatedBorder />
        <StatCard label="Avg Daily Usage" value={`${fleet.usage.avgDailyGB.toFixed(1)} GB`} tone="amber" animatedBorder />
      </div>

      <Card className="p-5">
        <p className="text-sm font-semibold text-text-primary">Top 10 Terminals by Usage</p>
        <p className="mb-4 text-xs text-text-muted">Current billing period</p>
        {chartData.length === 0 ? (
          <p className="py-6 text-center text-xs text-text-muted">No usage data yet.</p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232A33" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={{ stroke: "#232A33" }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}GB`} />
                <Tooltip
                  contentStyle={{ background: "#161B22", border: "1px solid #232A33", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#F3F4F6" }}
                  formatter={(value) => [`${value} GB`, "Usage"]}
                />
                <Bar dataKey="gb" fill="#3b82f6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {terminals.length === 0 ? (
        <EmptyState title="No usage data available" />
      ) : (
        <TableContainer>
          <Table>
            <THead>
              <TR>
                <TH>Terminal</TH>
                <TH>Customer</TH>
                <TH>Used</TH>
                <TH>Allowance</TH>
                <TH className="min-w-40">Usage</TH>
              </TR>
            </THead>
            <TBody>
              {terminals.map((t) => {
                const allowance = t.planBilling.planAllowanceGB;
                return (
                  <TR key={t.id}>
                    <TD className="font-medium text-text-primary">{t.identification.serialNumber}</TD>
                    <TD>{t.activation.assignedCustomerName ?? <span className="text-text-muted">Unassigned</span>}</TD>
                    <TD>{formatGB(t.usage.totalBytes)}</TD>
                    <TD>{allowance ? `${allowance} GB` : "Unlimited"}</TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <ProgressBar
                          value={t.planBilling.monthlyUsageGB}
                          max={allowance ?? Math.max(1, t.planBilling.monthlyUsageGB)}
                          tone={allowance && t.planBilling.monthlyUsageGB > allowance ? "red" : "green"}
                          className="w-24"
                        />
                        <span className="text-xs text-text-muted">
                          {allowance ? `${Math.min(100, Math.round((t.planBilling.monthlyUsageGB / allowance) * 100))}%` : "—"}
                        </span>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}
