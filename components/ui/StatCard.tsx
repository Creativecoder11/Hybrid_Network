import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Card } from "@/components/ui/Card";

export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  trend,
  tone = "neutral",
  animatedBorder = false,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon?: LucideIcon;
  trend?: { value: string; positive: boolean };
  tone?: "green" | "blue" | "amber" | "red" | "purple" | "neutral";
  animatedBorder?: boolean;
}) {
  const iconToneClasses: Record<string, string> = {
    green: "bg-accent-green/15 text-accent-green",
    blue: "bg-accent-blue/15 text-accent-blue",
    amber: "bg-amber/15 text-amber",
    red: "bg-red/15 text-red",
    purple: "bg-purple/15 text-purple",
    neutral: "bg-text-muted/15 text-text-secondary",
  };

  const card = (
    <Card className={cn("", animatedBorder && "border-transparent")}>
      <div className="flex px-5 pt-5 items-start justify-between">
        <p className="text-sm font-medium">{label}</p>
        {Icon && (
          <span className={cn("flex size-8 items-center justify-center rounded-lg", iconToneClasses[tone])}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p className="text-2xl px-[18px] pb-3 font-semibold text-text-primary">{value}</p>
      <div className="py-[10px] px-[16px] rounded-b-2xl flex items-center bg-[#303438]">
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium",
              trend.positive ? "text-accent-green" : "text-red"
            )}
          >
            {trend.positive ? (
              <ArrowUpRight className="size-3.5" />
            ) : (
              <ArrowDownRight className="size-3.5" />
            )}
            {trend.value}
          </span>
        )}
        {sublabel && <span className="text-xs text-text-muted">{sublabel}</span>}
      </div>
    </Card>
  );

  if (!animatedBorder) return card;

  return <div className="animated-border-card">{card}</div>;
}
