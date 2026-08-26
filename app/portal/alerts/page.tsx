import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/dal";
import { listTerminalAlerts } from "@/lib/terminals/alerts";
import { PortalAlertsClient } from "@/components/portal/PortalAlertsClient";

export const metadata: Metadata = {
  title: "Alerts | Hybrid Networks Portal",
};

export default async function PortalAlertsPage() {
  const user = await requireRole(["CUSTOMER"], "/admin");
  const alerts = await listTerminalAlerts({ customerId: user.id });

  return <PortalAlertsClient alerts={alerts} />;
}
