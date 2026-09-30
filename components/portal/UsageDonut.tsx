"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

// Ring sweep and centre count-up share one duration + ease-out curve so the
// number lands exactly as the ring finishes filling.
const ANIMATION_MS = 1200;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

// Gradient stops for the filled arc: normal, nearing the allowance (80%+),
// and at/over it (100%). Warning states stay amber/red so they still read as
// warnings at a glance.
const GRADIENTS = {
  normal: ["#4ADE80", "#3B82F6"],
  warning: ["#FCD34D", "#F59E0B"],
  over: ["#F87171", "#DC2626"],
} as const;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const mql = window.matchMedia(REDUCED_MOTION_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false
  );
}

/** Animates from the previously shown value to `target` (from 0 on first render). */
function useCountUp(target: number, enabled: boolean): number {
  const [value, setValue] = useState(enabled ? 0 : target);
  const fromRef = useRef(enabled ? 0 : target);

  useEffect(() => {
    const from = fromRef.current;
    if (!enabled || from === target) {
      fromRef.current = target;
      const id = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(id);
    }

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ANIMATION_MS);
      const current = from + (target - from) * easeOutCubic(t);
      fromRef.current = current;
      setValue(current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, enabled]);

  return value;
}

export function UsageDonut({
  usedGB,
  allowanceGB,
}: {
  usedGB: number;
  allowanceGB: number | null;
}) {
  const animate = !usePrefersReducedMotion();
  const pct = allowanceGB && allowanceGB > 0 ? Math.min(100, (usedGB / allowanceGB) * 100) : 0;
  const data = [
    { name: "used", value: pct },
    { name: "remaining", value: 100 - pct },
  ];
  const shownPct = useCountUp(pct, animate);
  const shownGB = useCountUp(usedGB, animate);

  const [fromColor, toColor] = GRADIENTS[pct >= 100 ? "over" : pct >= 80 ? "warning" : "normal"];
  // useId output isn't guaranteed to be a valid url(#...) fragment.
  const gradientId = `usage-donut-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <div className="relative size-36">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={fromColor} />
              <stop offset="100%" stopColor={toColor} />
            </linearGradient>
          </defs>
          <Pie
            data={data}
            dataKey="value"
            innerRadius="72%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            stroke="none"
            isAnimationActive={animate}
            animationBegin={0}
            animationDuration={ANIMATION_MS}
            animationEasing="ease-out"
          >
            <Cell fill={`url(#${gradientId})`} />
            <Cell fill="#1A1F27" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        {allowanceGB ? (
          <>
            <span className="text-xl font-bold tabular-nums text-text-primary">{shownPct.toFixed(0)}%</span>
            <span className="text-[10px] text-text-muted">of allowance</span>
          </>
        ) : (
          <>
            <span className="text-lg font-bold tabular-nums text-text-primary">{shownGB.toFixed(1)}</span>
            <span className="text-[10px] text-text-muted">GB · unlimited</span>
          </>
        )}
      </div>
    </div>
  );
}
