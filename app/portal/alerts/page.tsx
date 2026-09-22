import type { Metadata } from "next";
import { getPortalContext } from "@/lib/accounts/access";
import { listTerminalAlerts } from "@/lib/terminals/alerts";
import { PortalAlertsClient } from "@/components/portal/PortalAlertsClient";
import { NoAccountState } from "@/components/portal/NoAccountState";

export const metadata: Metadata = {
  title: "Alerts | Hybrid Networks Portal",
};

export default async function PortalAlertsPage() {
  const ctx = await getPortalContext();
  if (!ctx.account) return <NoAccountState title="Alerts" />;
  const alerts = await listTerminalAlerts({ accountIds: [ctx.account.id] });

  return <PortalAlertsClient alerts={alerts} />;
}
