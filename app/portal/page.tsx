import type { Metadata } from "next";
import { connectDB } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import { ActivityLog } from "@/models/ActivityLog";
import { requireRole } from "@/lib/auth/dal";
import { syncOverdueStatuses } from "@/lib/billing/statusSync";
import { getActivePlanInfo, getUsageForPeriod, currentPeriodMonth } from "@/lib/portal/data";
import { listTerminals } from "@/lib/terminals/service";
import { OverviewClient } from "@/components/portal/OverviewClient";
import type { PortalActivityRow, PortalInvoiceRow, PortalTerminalSummary } from "@/lib/types/portal";

export const metadata: Metadata = {
  title: "Overview | Hybrid Networks Portal",
};

export default async function PortalOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(["CUSTOMER"], "/admin");
  const sp = await searchParams;
  const periodParam = typeof sp.period === "string" ? sp.period : "";
  const periodMonth = /^\d{6}$/.test(periodParam) ? periodParam : currentPeriodMonth();

  await syncOverdueStatuses();
  await connectDB();

  const [plan, usage, outstandingInvoice, latestBillsRaw, activityRaw, terminals] = await Promise.all([
    getActivePlanInfo(user.id),
    getUsageForPeriod(user.id, periodMonth),
    Invoice.findOne({ customer: user.id, status: { $in: ["DUE", "OVERDUE", "SENT"] } }).sort({ dueDate: 1 }),
    Invoice.find({ customer: user.id }).sort({ issueDate: -1 }).limit(5).lean(),
    ActivityLog.find({ targetCustomer: user.id }).sort({ createdAt: -1 }).limit(6).lean(),
    listTerminals({ customerId: user.id }),
  ]);

  const terminalSummary: PortalTerminalSummary = {
    totalCount: terminals.length,
    activeCount: terminals.filter((t) => t.live.onlineStatus === "ONLINE").length,
    avgThroughputMbps:
      terminals.length > 0
        ? Math.round((terminals.reduce((sum, t) => sum + t.network.throughputMbps, 0) / terminals.length) * 10) / 10
        : 0,
  };

  const currentBill: PortalInvoiceRow | null = outstandingInvoice
    ? {
        id: outstandingInvoice._id.toString(),
        invoiceNumber: outstandingInvoice.invoiceNumber,
        periodMonth: outstandingInvoice.periodMonth,
        issueDate: outstandingInvoice.issueDate.toISOString(),
        dueDate: outstandingInvoice.dueDate.toISOString(),
        total: outstandingInvoice.total,
        currency: outstandingInvoice.currency ?? "USD",
        status: outstandingInvoice.status,
      }
    : null;

  const latestBills: PortalInvoiceRow[] = latestBillsRaw.map((inv) => ({
    id: inv._id.toString(),
    invoiceNumber: inv.invoiceNumber,
    periodMonth: inv.periodMonth,
    issueDate: (inv.issueDate as Date).toISOString(),
    dueDate: (inv.dueDate as Date).toISOString(),
    total: inv.total,
    currency: inv.currency ?? "USD",
    status: inv.status,
  }));

  const activity: PortalActivityRow[] = activityRaw.map((a) => ({
    id: a._id.toString(),
    action: a.action,
    meta: (a.meta as Record<string, unknown>) ?? {},
    createdAt: (a.createdAt as Date | undefined)?.toISOString() ?? "",
  }));

  return (
    <OverviewClient
      customerName={user.name}
      currentBill={currentBill}
      plan={plan}
      usage={usage}
      periodMonth={periodMonth}
      terminalSummary={terminalSummary}
      latestBills={latestBills}
      activity={activity}
    />
  );
}
