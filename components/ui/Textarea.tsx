import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <textarea
          ref={ref}
          className={cn(
            "w-full rounded-xl border border-line bg-surface-raised px-3.5 py-2.5 text-sm text-text-primary",
            "placeholder:text-text-muted transition-colors resize-y min-h-24",
            "focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue/50",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-red/50 focus:ring-red/30",
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-red">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
