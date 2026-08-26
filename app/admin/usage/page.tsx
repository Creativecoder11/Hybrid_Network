import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/dal";
import { listTerminals } from "@/lib/terminals/service";
import { computeFleetOverview } from "@/lib/terminals/fleetStats";
import { UsagePageClient } from "@/components/admin/UsagePageClient";

export const metadata: Metadata = {
  title: "Fleet Usage | Hybrid Networks Admin",
};

export default async function AdminUsagePage() {
  await requireRole(["SUPER_ADMIN", "SUB_ADMIN"], "/portal");
  const terminals = await listTerminals();
  const fleet = computeFleetOverview(terminals);

  return <UsagePageClient terminals={terminals} fleet={fleet} />;
}
