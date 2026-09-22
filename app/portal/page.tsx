import type { Metadata } from "next";
import { connectDB } from "@/lib/db/connect";
import { ActivityLog } from "@/models/ActivityLog";
import { getPortalContext } from "@/lib/accounts/access";
import { syncOverdueStatuses } from "@/lib/billing/statusSync";
import { getActivePlanInfo, getUsageForPeriod, getServiceLinePlans, currentPeriodMonth } from "@/lib/portal/data";
import { getPaymentInfo, listAccountInvoices } from "@/lib/portal/billing";
import { listTerminals } from "@/lib/terminals/service";
import { OverviewClient } from "@/components/portal/OverviewClient";
import { NoAccountState } from "@/components/portal/NoAccountState";
import type { PortalActivityRow, PortalTerminalSummary } from "@/lib/types/portal";

export const metadata: Metadata = {
  title: "Overview | Hybrid Networks Portal",
};

export default async function PortalOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getPortalContext();
  if (!ctx.account) return <NoAccountState title="Overview" />;
  const account = ctx.account;

  const sp = await searchParams;
  const periodParam = typeof sp.period === "string" ? sp.period : "";
  const periodMonth = /^\d{6}$/.test(periodParam) ? periodParam : currentPeriodMonth();

  await syncOverdueStatuses();
  await connectDB();

  const [plan, usage, payment, latestBills, activityRaw, terminals, serviceLines] = await Promise.all([
    getActivePlanInfo(account.id),
    getUsageForPeriod(account.id, periodMonth),
    getPaymentInfo(account),
    listAccountInvoices(account, { limit: 5 }),
    // Billing / plan events for this account only; support tickets are
    // company-wide.
    ActivityLog.find({
      $or: [
        { targetAccount: account.id, action: { $in: ["INVOICE_SENT", "INVOICE_PAID", "PLAN_CHANGED"] } },
        { targetCustomer: ctx.profile.id, action: { $in: ["TICKET_CREATED", "TICKET_REPLIED", "TICKET_STATUS_CHANGED"] } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
    listTerminals({ accountIds: [account.id] }),
    getServiceLinePlans(account),
  ]);

  const online = terminals.filter((t) => t.live.onlineStatus === "ONLINE");
  const downlinks = online.map((t) => t.network.downlinkThroughputMbps).filter((v): v is number => v !== null);
  const terminalSummary: PortalTerminalSummary = {
    totalCount: terminals.length,
    activeCount: online.length,
    avgThroughputMbps: downlinks.length > 0 ? Math.round((downlinks.reduce((a, b) => a + b, 0) / downlinks.length) * 10) / 10 : null,
    terminals: terminals.map((t) => ({
      id: t.id,
      name: t.activation.displayName || t.identification.serialNumber,
      serialNumber: t.identification.serialNumber,
      onlineStatus: t.live.onlineStatus,
      statusReason: t.live.statusReason,
      lastSeenAt: t.live.lastSeenAt,
    })),
  };

  // Live Starlink usage for the current cycle, summed across the account's
  // service lines (only when every line reported it).
  const liveUsage = serviceLines.length > 0 && serviceLines.every((s) => s.usage)
    ? {
        totalGB: Math.round(serviceLines.reduce((sum, s) => sum + (s.usage?.totalGB ?? 0), 0) * 100) / 100,
        allowanceGB: serviceLines.every((s) => s.allocatedDataGB !== null || s.priorityDataGB !== null)
          ? Math.round(serviceLines.reduce((sum, s) => sum + (s.allocatedDataGB ?? s.priorityDataGB ?? 0), 0) * 100) / 100
          : null,
        cycleStart: serviceLines[0].usage?.billingCycleStart ?? null,
        cycleEnd: serviceLines[0].usage?.billingCycleEnd ?? null,
        lastUpdatedAt: serviceLines[0].usage?.lastUpdatedAt ?? null,
      }
    : null;

  const activity: PortalActivityRow[] = activityRaw.map((a) => ({
    id: a._id.toString(),
    action: a.action,
    meta: (a.meta as Record<string, unknown>) ?? {},
    createdAt: (a.createdAt as Date | undefined)?.toISOString() ?? "",
  }));

  return (
    <OverviewClient
      customerName={ctx.user.name}
      accountNumber={account.accountNumber}
      payment={payment}
      plan={plan}
      usage={usage}
      liveUsage={liveUsage}
      periodMonth={periodMonth}
      terminalSummary={terminalSummary}
      latestBills={latestBills}
      activity={activity}
    />
  );
}
