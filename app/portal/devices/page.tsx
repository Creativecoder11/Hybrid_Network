import type { Metadata } from "next";
import { Satellite } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { listTerminals } from "@/lib/terminals/service";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeviceCard } from "@/components/portal/DeviceCard";

export const metadata: Metadata = {
  title: "My Devices | Hybrid Networks Portal",
};

export default async function PortalDevicesPage() {
  const user = await requireRole(["CUSTOMER"], "/admin");
  const terminals = await listTerminals({ customerId: user.id });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">My Devices</h1>
        <p className="text-sm text-text-muted">Connection status, usage, and health for your terminal(s).</p>
      </div>

      {terminals.length === 0 ? (
        <EmptyState
          icon={Satellite}
          title="No devices on this account"
          description="Contact support if you believe this is a mistake."
        />
      ) : (
        <div className="space-y-4">
          {terminals.map((t) => (
            <DeviceCard key={t.id} terminal={t} />
          ))}
        </div>
      )}
    </div>
  );
}
