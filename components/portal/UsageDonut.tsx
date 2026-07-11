"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

export function UsageDonut({
  usedGB,
  allowanceGB,
}: {
  usedGB: number;
  allowanceGB: number | null;
}) {
  const pct = allowanceGB && allowanceGB > 0 ? Math.min(100, (usedGB / allowanceGB) * 100) : 0;
  const data = [
    { name: "used", value: pct },
    { name: "remaining", value: 100 - pct },
  ];

  const overTone = pct >= 100 ? "#F87171" : pct >= 80 ? "#F59E0B" : "#4ADE80";

  return (
    <div className="relative size-36">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius="72%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            stroke="none"
          >
            <Cell fill={overTone} />
            <Cell fill="#1A1F27" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        {allowanceGB ? (
          <>
            <span className="text-xl font-bold text-text-primary">{pct.toFixed(0)}%</span>
            <span className="text-[10px] text-text-muted">of allowance</span>
          </>
        ) : (
          <>
            <span className="text-lg font-bold text-text-primary">{usedGB.toFixed(1)}</span>
            <span className="text-[10px] text-text-muted">GB · unlimited</span>
          </>
        )}
      </div>
    </div>
  );
}
