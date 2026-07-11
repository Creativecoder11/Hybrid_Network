import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type BadgeTone =
  | "green"
  | "amber"
  | "red"
  | "blue"
  | "neutral";

const toneClasses: Record<BadgeTone, string> = {
  green: "bg-accent-green/15 text-accent-green",
  amber: "bg-amber/15 text-amber",
  red: "bg-red/15 text-red",
  blue: "bg-accent-blue/15 text-accent-blue",
  neutral: "bg-text-muted/15 text-text-secondary",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}

const STATUS_TONE_MAP: Record<string, BadgeTone> = {
  ACTIVE: "green",
  PAID: "green",
  COMPLETED: "green",
  RESOLVED: "green",
  DUE: "amber",
  SENT: "amber",
  IN_PROGRESS: "amber",
  PROCESSING: "amber",
  INVITED: "amber",
  OVERDUE: "red",
  SUSPENDED: "red",
  FAILED: "red",
  CANCELLED: "red",
  CLOSED: "neutral",
  DRAFT: "neutral",
  PAUSED: "neutral",
  OPEN: "blue",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = STATUS_TONE_MAP[status] ?? "neutral";
  const label = status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
  return (
    <Badge tone={tone} className={className}>
      {label}
    </Badge>
  );
}
