"use client";

import { cn } from "@/lib/utils/cn";

export function Switch({
  checked,
  onChange,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300 ease-in-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-accent-green" : "bg-surface-raised border border-line",
        className
      )}
    >
      <span
        className={cn(
          "absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-md",
          "transition-transform duration-300 ease-in-out",
          checked && "translate-x-5"
        )}
      />
    </button>
  );
}
