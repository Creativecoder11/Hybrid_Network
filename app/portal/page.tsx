import type { Metadata } from "next";
import { connectDB } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import { ActivityLog } from "@/models/ActivityLog";
import { requireRole } from "@/lib/auth/dal";
import { syncOverdueStatuses } from "@/lib/billing/statusSync";
import { getActivePlanInfo, getUsageForPeriod, currentPeriodMonth } from "@/lib/portal/data";
import { OverviewClient } from "@/components/portal/OverviewClient";
import type { PortalActivityRow, PortalInvoiceRow } from "@/lib/types/portal";

export const metadata: Metadata = {
  title: "Overview | Hybrid Networks Portal",
};

export default async function PortalOverviewPage() {
  const user = await requireRole(["CUSTOMER"], "/admin");

  await syncOverdueStatuses();
  await connectDB();

  const [plan, usage, outstandingInvoice, latestBillsRaw, activityRaw] = await Promise.all([
    getActivePlanInfo(user.id),
    getUsageForPeriod(user.id, currentPeriodMonth()),
    Invoice.findOne({ customer: user.id, status: { $in: ["DUE", "OVERDUE", "SENT"] } }).sort({ dueDate: 1 }),
    Invoice.find({ customer: user.id }).sort({ issueDate: -1 }).limit(5).lean(),
    ActivityLog.find({ targetCustomer: user.id }).sort({ createdAt: -1 }).limit(6).lean(),
  ]);

  const currentBill: PortalInvoiceRow | null = outstandingInvoice
    ? {
        id: outstandingInvoice._id.toString(),
        invoiceNumber: outstandingInvoice.invoiceNumber,
        periodMonth: outstandingInvoice.periodMonth,
        issueDate: outstandingInvoice.issueDate.toISOString(),
        dueDate: outstandingInvoice.dueDate.toISOString(),
        total: outstandingInvoice.total,
        currency: outstandingInvoice.currency ?? "MYR",
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
    currency: inv.currency ?? "MYR",
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
      latestBills={latestBills}
      activity={activity}
    />
  );
}
