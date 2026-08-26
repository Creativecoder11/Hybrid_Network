import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/dal";
import { listTerminals } from "@/lib/terminals/service";
import { computeFleetOverview } from "@/lib/terminals/fleetStats";
import { AnalyticsPageClient } from "@/components/admin/AnalyticsPageClient";

export const metadata: Metadata = {
  title: "Fleet Analytics | Hybrid Networks Admin",
};

export default async function AdminAnalyticsPage() {
  await requireRole(["SUPER_ADMIN", "SUB_ADMIN"], "/portal");
  const terminals = await listTerminals();
  const fleet = computeFleetOverview(terminals);

  return <AnalyticsPageClient terminals={terminals} fleet={fleet} />;
}
