import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/dal";
import { listTerminals } from "@/lib/terminals/service";
import { TrackingPageClient } from "@/components/shared/TrackingPageClient";

export const metadata: Metadata = {
  title: "GPS Tracking | Hybrid Networks Portal",
};

export default async function PortalTrackingPage() {
  const user = await requireRole(["CUSTOMER"], "/admin");
  const terminals = await listTerminals({ customerId: user.id });

  return <TrackingPageClient terminals={terminals} detailBasePath="/portal/devices" />;
}
