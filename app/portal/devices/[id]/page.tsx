import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { getTerminal } from "@/lib/terminals/service";
import { listTerminalAlerts } from "@/lib/terminals/alerts";
import { DeviceDetailClient } from "@/components/portal/DeviceDetailClient";

export const metadata: Metadata = {
  title: "Device Detail | Hybrid Networks Portal",
};

export default async function PortalDeviceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["CUSTOMER"], "/admin");
  const { id } = await params;
  const terminal = await getTerminal(decodeURIComponent(id));

  // Ownership check — customers may only view their own terminals, enforced
  // server-side regardless of what the URL contains.
  if (!terminal || terminal.activation.assignedCustomerId !== user.id) notFound();

  const alerts = await listTerminalAlerts({ customerId: user.id });
  const terminalAlerts = alerts.filter((a) => a.userTerminalId === terminal.id);

  return <DeviceDetailClient terminal={terminal} alerts={terminalAlerts} />;
}
