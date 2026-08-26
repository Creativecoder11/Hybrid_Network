import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/dal";
import { listTerminalAlerts } from "@/lib/terminals/alerts";
import { AlertsPageClient } from "@/components/admin/AlertsPageClient";

export const metadata: Metadata = {
  title: "Alerts | Hybrid Networks Admin",
};

export default async function AdminAlertsPage() {
  await requireRole(["SUPER_ADMIN", "SUB_ADMIN"], "/portal");
  const alerts = await listTerminalAlerts();

  return <AlertsPageClient alerts={alerts} />;
}
