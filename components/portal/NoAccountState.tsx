import { Building2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

/** Shown on account-scoped portal pages when the user has no Customer Account yet. */
export function NoAccountState({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <p className="text-xl font-bold text-text-primary">{title}</p>
      <EmptyState
        icon={Building2}
        title="No customer account assigned yet"
        description="Your login isn't linked to a Customer Account. Please contact Hybrid Networks support."
      />
    </div>
  );
}
