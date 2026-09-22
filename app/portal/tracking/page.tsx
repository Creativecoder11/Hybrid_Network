import type { Metadata } from "next";
import { EyeOff } from "lucide-react";
import { getPortalContext } from "@/lib/accounts/access";
import { listAccountTerminals } from "@/lib/terminals/service";
import { EmptyState } from "@/components/ui/EmptyState";
import { TrackingPageClient } from "@/components/shared/TrackingPageClient";
import { NoAccountState } from "@/components/portal/NoAccountState";
import { RetryNotice } from "@/components/portal/RetryNotice";

export const metadata: Metadata = {
  title: "GPS Tracking | Hybrid Networks Portal",
};

export default async function PortalTrackingPage() {
  const ctx = await getPortalContext();

  // Enforced here (and in getTerminalLocationHistoryAction), not just by
  // hiding the menu item: no location data is loaded when tracking is off.
  if (!ctx.features.tracking) {
    return (
      <div className="space-y-6">
        <p className="text-2xl font-bold">GPS Tracking</p>
        <EmptyState
          icon={EyeOff}
          title="Tracking is not available"
          description="Device tracking has been disabled by your administrator."
        />
      </div>
    );
  }
  if (!ctx.account) return <NoAccountState title="GPS Tracking" />;

  const { terminals, unavailable } = await listAccountTerminals([ctx.account.id]);

  return (
    <div className="space-y-4">
      {unavailable && <RetryNotice message="Unable to load some device locations from Starlink right now. Please try again." />}
      <TrackingPageClient terminals={terminals} detailBasePath="/portal/devices" />
    </div>
  );
}
