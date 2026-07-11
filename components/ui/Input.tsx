import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, icon, trailing, ...props }, ref) => {
    return (
      <div className="w-full">
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            className={cn(
              "h-10 w-full rounded-xl border border-line bg-surface-raised px-3.5 text-sm text-text-primary",
              "placeholder:text-text-muted transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue/50",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              icon && "pl-9",
              trailing && "pr-9",
              error && "border-red/50 focus:ring-red/30",
              className
            )}
            {...props}
          />
          {trailing && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
              {/* {trailing} */}
            </span>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
