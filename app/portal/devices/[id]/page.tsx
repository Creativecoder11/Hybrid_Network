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
  const terminal = await getTerminal(decodeURIComponent(id), ctx.account?.id);

  if (!terminal) notFound();

  // Ownership check — verify the terminal belongs to this customer:
  // 1. Direct match on assignedAccountId in user's authorized accounts
  // 2. Or the terminal's sourceVesselId matches one of user's authorized accounts' starlinkVesselIds
  // 3. Or user's selected account context if linked
  const authorizedAccount =
    ctx.accounts.find((a) => a.id === terminal.activation.assignedAccountId) ||
    ctx.accounts.find((a) => terminal.sourceVesselId && a.starlinkVesselIds.includes(terminal.sourceVesselId)) ||
    (terminal.sourceVesselId && ctx.account && ctx.account.starlinkVesselIds.includes(terminal.sourceVesselId) ? ctx.account : null);

  const hasAccess =
    canAccessAccount(ctx, terminal.activation.assignedAccountId) ||
    Boolean(
      terminal.sourceVesselId &&
        ctx.accounts.some((a) => a.starlinkVesselIds.includes(terminal.sourceVesselId!))
    );

  if (!hasAccess && !authorizedAccount) notFound();

  const activeAccount = authorizedAccount || ctx.account || ctx.accounts[0];
  if (activeAccount && terminal.activation.assignedAccountId !== activeAccount.id) {
    terminal.activation.assignedAccountId = activeAccount.id;
    terminal.activation.assignedAccountNumber = activeAccount.accountNumber;
    terminal.activation.assignedCustomerName = ctx.profile.company || ctx.profile.name;
    terminal.activation.assignedCustomerId = ctx.profile.id;
  }

  const alerts = await listTerminalAlerts({
    accountIds: terminal.activation.assignedAccountId ? [terminal.activation.assignedAccountId] : [],
  });
  const terminalAlerts = alerts.filter((a) => a.deviceId === terminal.id);

  return (
    <DeviceDetailClient
      terminal={applyLocationPolicy(terminal, ctx.features)}
      alerts={terminalAlerts}
      locationEnabled={ctx.features.deviceLocation}
    />
  );
}
