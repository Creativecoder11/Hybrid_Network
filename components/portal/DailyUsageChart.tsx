"use client";

import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Legend } from "recharts";
import type { PortalDailyUsageRow } from "@/lib/types/portal";

// Daily Starlink data usage (SLASH data-usage/history), stacked by data class.
export function DailyUsageChart({ data }: { data: PortalDailyUsageRow[] }) {
  const chartData = data.map((d) => ({
    day: new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }),
    Priority: d.priorityGB,
    Standard: d.standardGB,
    "Non-billable": d.nonBillableGB,
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#232A33" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={{ stroke: "#232A33" }} minTickGap={12} />
          <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} unit=" GB" width={64} />
          <Tooltip
            contentStyle={{ background: "#161B22", border: "1px solid #232A33", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#F3F4F6" }}
            formatter={(value) => `${Number(value).toFixed(2)} GB`}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Priority" stackId="usage" fill="#4ADE80" />
          <Bar dataKey="Standard" stackId="usage" fill="#3B82F6" />
          <Bar dataKey="Non-billable" stackId="usage" fill="#6B7280" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
