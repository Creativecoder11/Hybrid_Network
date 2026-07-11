import type { LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Label({
  className,
  required,
  children,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label
      className={cn("mb-1.5 block text-xs font-medium text-text-secondary", className)}
      {...props}
    >
      {children}
      {required && <span className="ml-0.5 text-red">*</span>}
    </label>
  );
}
