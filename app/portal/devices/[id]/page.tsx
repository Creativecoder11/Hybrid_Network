import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalContext, canAccessAccount } from "@/lib/accounts/access";
import { applyLocationPolicy } from "@/lib/portal/features";
import { getTerminal } from "@/lib/terminals/service";
import { listTerminalAlerts } from "@/lib/terminals/alerts";
import { DeviceDetailClient } from "@/components/portal/DeviceDetailClient";

export const metadata: Metadata = {
  title: "Device Detail | Hybrid Networks Portal",
};

export default async function PortalDeviceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getPortalContext();
  const { id } = await params;
  const terminal = await getTerminal(decodeURIComponent(id));

  // Ownership check — the terminal's Customer Account must be one of this
  // user's authorized accounts, enforced server-side regardless of the URL.
  if (!terminal || !canAccessAccount(ctx, terminal.activation.assignedAccountId)) notFound();

  const alerts = await listTerminalAlerts({ accountIds: [terminal.activation.assignedAccountId as string] });
  const terminalAlerts = alerts.filter((a) => a.deviceId === terminal.id);

  return (
    <DeviceDetailClient
      terminal={applyLocationPolicy(terminal, ctx.features)}
      alerts={terminalAlerts}
      locationEnabled={ctx.features.deviceLocation}
    />
  );
}
