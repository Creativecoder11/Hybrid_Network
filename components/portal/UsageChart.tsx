"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  Line,
  Legend,
} from "recharts";
import { formatPeriodMonth } from "@/lib/utils/format";
import type { PortalUsageHistoryRow } from "@/lib/types/portal";

export function UsageChart({ data }: { data: PortalUsageHistoryRow[] }) {
  const chartData = data.map((d) => ({
    period: formatPeriodMonth(d.periodMonth).replace(" 20", " '"),
    "Data (GB)": d.volumeDataGB,
    "Voice (min)": d.volumeMin,
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#232A33" vertical={false} />
          <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={{ stroke: "#232A33" }} />
          <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fill: "#9CA3AF" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#161B22",
              border: "1px solid #232A33",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#F3F4F6" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="left" dataKey="Data (GB)" fill="#4ADE80" radius={[4, 4, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="Voice (min)" stroke="#3B82F6" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
