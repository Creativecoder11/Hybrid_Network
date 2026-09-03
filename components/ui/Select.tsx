import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    return (
      <div className={cn("w-full", className)}>
        <div className="relative">
          <select
            ref={ref}
            className={cn(
              "h-10 w-full appearance-none rounded-xl border border-line bg-surface-raised px-3.5 pr-9 text-sm text-text-primary",
              "transition-colors focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue/50",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              error && "border-red/50 focus:ring-red/30"
            )}
            {...props}
          >
            {children}
          </select>

          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
        </div>

        {error && <p className="mt-1 text-xs text-red">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";
