"use client";

import { cn } from "@/lib/utils/cn";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { label: string; value: T; tone?: "green" | "amber" | "red" }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const toneActive: Record<string, string> = {
    green: "bg-accent-green/15 text-accent-green border-accent-green/40",
    amber: "bg-amber/15 text-amber border-amber/40",
    red: "bg-red/15 text-red border-red/40",
  };

  return (
    <div className={cn("inline-flex flex-wrap gap-2", className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              active
                ? (opt.tone && toneActive[opt.tone]) || "bg-accent-blue/15 text-accent-blue border-accent-blue/40"
                : "border-line text-text-secondary hover:bg-surface-raised"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
