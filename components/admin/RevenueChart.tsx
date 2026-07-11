"use client";

import { useState } from "react";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Select } from "@/components/ui/Select";
import { formatPeriodMonth, formatCurrency } from "@/lib/utils/format";
import type { RevenuePoint } from "@/lib/types/dashboard";

const RANGE_OPTIONS = [
  { label: "Last 3 months", months: 3 },
  { label: "Last 6 months", months: 6 },
  { label: "Last 12 months", months: 12 },
] as const;

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const [months, setMonths] = useState(6);

  const sliced = data.slice(Math.max(0, data.length - months));
  const chartData = sliced.map((d) => ({
    month: formatPeriodMonth(d.month).replace(" 20", " '"),
    revenue: d.revenue,
  }));

  return (
    <div>
      <div className="mb-3 flex items-center justify-end">
        <Select
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
          className="h-8 w-40 py-0 text-xs"
        >
          {RANGE_OPTIONS.map((opt) => (
            <option key={opt.months} value={opt.months}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4ADE80" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#4ADE80" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#232A33" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={{ stroke: "#232A33" }} />
            <YAxis
              tick={{ fontSize: 11, fill: "#9CA3AF" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{ background: "#161B22", border: "1px solid #232A33", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "#F3F4F6" }}
              formatter={(value) => [formatCurrency(Number(value)), "Revenue"]}
            />
            <Area type="monotone" dataKey="revenue" stroke="#4ADE80" strokeWidth={2} fill="url(#revenueFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
