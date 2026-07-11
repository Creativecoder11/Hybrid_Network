import { forwardRef, type InputHTMLAttributes } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
        <input
          ref={ref}
          type="checkbox"
          className={cn(
            "peer size-4 shrink-0 appearance-none rounded-md border border-line bg-surface-raised",
            "checked:bg-accent-green checked:border-accent-green",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/40",
            "cursor-pointer transition-colors",
            className
          )}
          {...props}
        />
        <Check className="pointer-events-none absolute size-3 text-[#052e16] opacity-0 peer-checked:opacity-100" />
      </span>
    );
  }
);
Checkbox.displayName = "Checkbox";
