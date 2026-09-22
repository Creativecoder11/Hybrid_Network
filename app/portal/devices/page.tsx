import type { Metadata } from "next";
import { Satellite } from "lucide-react";
import { getPortalContext } from "@/lib/accounts/access";
import { applyLocationPolicy } from "@/lib/portal/features";
import { listAccountTerminals } from "@/lib/terminals/service";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeviceCard } from "@/components/portal/DeviceCard";
import { NoAccountState } from "@/components/portal/NoAccountState";
import { RetryNotice } from "@/components/portal/RetryNotice";

export const metadata: Metadata = {
  title: "My Devices | Hybrid Networks Portal",
};

export default async function PortalDevicesPage() {
  const ctx = await getPortalContext();
  if (!ctx.account) return <NoAccountState title="My Devices" />;

  const { terminals: raw, unavailable } = await listAccountTerminals([ctx.account.id]);
  // Location is stripped on the server when the Super Admin has disabled it.
  const terminals = raw.map((t) => applyLocationPolicy(t, ctx.features));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-xl font-bold text-text-primary">My Devices</p>
        <p className="text-sm text-text-muted">
          Live status of the Starlink terminals on account <span className="font-mono">{ctx.account.accountNumber}</span>.
        </p>
      </div>

      {unavailable && (
        <RetryNotice message="Unable to load some device information from Starlink right now. Please try again." />
      )}

      {terminals.length === 0 ? (
        unavailable ? null : (
          <EmptyState
            icon={Satellite}
            title="No devices found for this account"
            description="Contact support if you believe a terminal should be linked to this account."
          />
        )
      ) : (
        <div className="space-y-4">
          {terminals.map((t) => (
            <DeviceCard key={t.id} terminal={t} showLocation={ctx.features.deviceLocation} />
          ))}
        </div>
      )}
    </div>
  );
}
