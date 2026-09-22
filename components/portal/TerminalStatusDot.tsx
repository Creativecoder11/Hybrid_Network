import { cn } from "@/lib/utils/cn";
import type { OnlineStatus } from "@/lib/terminals/types";

const STYLES: Record<OnlineStatus, { dot: string; text: string; label: string }> = {
  ONLINE: { dot: "bg-accent-green", text: "text-accent-green", label: "Online" },
  OFFLINE: { dot: "bg-red", text: "text-red", label: "Offline" },
  UNKNOWN: { dot: "bg-text-muted", text: "text-text-muted", label: "Unknown" },
};

/** "● Online" / "● Offline" / "● Unknown" — the terminal's normalized connectivity. */
export function TerminalStatusDot({ status, className }: { status: OnlineStatus; className?: string }) {
  const s = STYLES[status];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-xs font-medium", s.text, className)}>
      <span className={cn("size-2 rounded-full", s.dot, status === "ONLINE" && "animate-pulse")} />
      {s.label}
    </span>
  );
}
