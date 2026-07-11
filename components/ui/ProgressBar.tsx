import { cn } from "@/lib/utils/cn";

export function ProgressBar({
  value,
  max = 100,
  className,
  barClassName,
  tone = "green",
}: {
  value: number;
  max?: number;
  className?: string;
  barClassName?: string;
  tone?: "green" | "blue" | "amber" | "red";
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const toneClasses: Record<string, string> = {
    green: "bg-accent-green",
    blue: "bg-accent-blue",
    amber: "bg-amber",
    red: "bg-red",
  };

  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-raised", className)}>
      <div
        className={cn("h-full rounded-full transition-all", toneClasses[tone], barClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function LabeledProgress({
  label,
  value,
  max,
  displayValue,
  tone = "green",
}: {
  label: string;
  value: number;
  max: number;
  displayValue?: string;
  tone?: "green" | "blue" | "amber" | "red";
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-text-secondary">{label}</span>
        <span className="font-medium text-text-primary">{displayValue}</span>
      </div>
      <ProgressBar value={value} max={max} tone={tone} />
    </div>
  );
}
