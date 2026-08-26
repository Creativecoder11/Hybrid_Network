import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/dal";
import { listTerminals } from "@/lib/terminals/service";
import { TrackingPageClient } from "@/components/shared/TrackingPageClient";

export const metadata: Metadata = {
  title: "GPS Tracking | Hybrid Networks Admin",
};

export default async function AdminTrackingPage() {
  await requireRole(["SUPER_ADMIN", "SUB_ADMIN"], "/portal");
  const terminals = await listTerminals();

  return <TrackingPageClient terminals={terminals} detailBasePath="/admin/terminals" />;
}
