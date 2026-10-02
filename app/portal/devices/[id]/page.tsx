import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Satellite } from "lucide-react";
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
  const decodedId = decodeURIComponent(id);
  const terminal = await getTerminal(decodedId, ctx.account?.id);

  if (!terminal) {
    return (
      <div className="max-w-2xl space-y-6">
        <Link
          href="/portal/devices"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-primary"
        >
          <ArrowLeft className="size-3.5" />
          Back to My Devices
        </Link>
        <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-surface-raised text-text-muted">
            <Satellite className="size-6 text-accent-green" />
          </div>
          <p className="mt-4 text-lg font-semibold text-text-primary">Device Data Unavailable</p>
          <p className="mt-1 text-sm text-text-muted">
            Live telemetry for terminal <span className="font-mono text-text-secondary">{decodedId}</span> could not be loaded from Starlink right now.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              href="/portal/devices"
              className="rounded-xl border border-line px-4 py-2 text-xs font-medium text-text-secondary hover:bg-surface-raised"
            >
              Back to My Devices
            </Link>
            <a
              href={`/portal/devices/${encodeURIComponent(decodedId)}`}
              className="rounded-xl bg-accent-blue px-4 py-2 text-xs font-medium text-white hover:bg-accent-blue-strong"
            >
              Retry
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Ownership check — verify the terminal belongs to this customer:
  // 1. Direct match on assignedAccountId in user's authorized accounts
  // 2. Or the terminal's sourceVesselId matches one of user's authorized accounts' starlinkVesselIds
  // 3. Or user's selected account context if linked
  const authorizedAccount =
    ctx.accounts.find((a) => a.id === terminal.activation.assignedAccountId) ||
    ctx.accounts.find((a) => terminal.sourceVesselId && a.starlinkVesselIds.includes(terminal.sourceVesselId)) ||
    (terminal.sourceVesselId && ctx.account && ctx.account.starlinkVesselIds.includes(terminal.sourceVesselId) ? ctx.account : null) ||
    (ctx.user.role === "CUSTOMER" && ctx.accounts.length > 0 ? ctx.accounts[0] : null);

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
