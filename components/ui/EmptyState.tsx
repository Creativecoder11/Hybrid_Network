import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      <div className="mb-1 flex size-12 items-center justify-center rounded-full bg-surface-raised text-text-muted">
        <Icon className="size-6" />
      </div>
      <p className="text-sm font-medium text-text-primary">{title}</p>
      {description && <p className="max-w-sm text-xs text-text-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
