import "server-only";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/models/User";
import { Invoice } from "@/models/Invoice";
import { Subscription } from "@/models/Subscription";
import { UsageRecord } from "@/models/UsageRecord";
import { CdrBatch } from "@/models/CdrBatch";
import type { AdminDashboardStats, OutstandingBillRow, RevenuePoint, TopCustomerRow } from "@/lib/types/dashboard";

const GB = 1_000_000_000;

function monthKey(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthsAgoDate(n: number): Date {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return d;
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  await connectDB();

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const currentPeriod = monthKey(now);

  const [
    totalCustomers,
    totalCustomersPrevMonth,
    activeCustomers,
    monthlyRevenueAgg,
    prevMonthRevenueAgg,
    outstandingAgg,
    lastBatch,
    outstandingInvoices,
    paidInvoicesLast12mo,
    currentPeriodInvoices,
    planRevenueAgg,
  ] = await Promise.all([
    User.countDocuments({ role: "CUSTOMER" }),
    User.countDocuments({ role: "CUSTOMER", createdAt: { $lt: currentMonthStart } }),
    User.countDocuments({ role: "CUSTOMER", status: "ACTIVE" }),
    Invoice.aggregate([
      { $match: { status: "PAID", paidDate: { $gte: currentMonthStart } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    Invoice.aggregate([
      { $match: { status: "PAID", paidDate: { $gte: prevMonthStart, $lt: currentMonthStart } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    Invoice.aggregate([
      { $match: { status: { $in: ["DUE", "OVERDUE"] } } },
      { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } },
    ]),
    CdrBatch.findOne().sort({ createdAt: -1 }).lean(),
    Invoice.find({ status: { $in: ["DUE", "OVERDUE"] } })
      .sort({ dueDate: 1 })
      .limit(8)
      .populate("customer")
      .lean(),
    Invoice.find({ status: "PAID", paidDate: { $gte: monthsAgoDate(11) } }).lean(),
    Invoice.find({ periodMonth: currentPeriod, status: { $ne: "CANCELLED" } }).populate("customer").lean(),
    Invoice.find({ status: "PAID", paidDate: { $gte: currentMonthStart } })
      .populate({ path: "subscription", populate: { path: "plan" } })
      .lean(),
  ]);

  // ----- Revenue series: last 12 months of collected (PAID) revenue -----
  // (fetched as 12 so the dashboard's period selector can slice to 3/6/12 client-side)
  const revenueByMonth = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    revenueByMonth.set(monthKey(monthsAgoDate(i)), 0);
  }
  for (const inv of paidInvoicesLast12mo) {
    const key = monthKey(inv.paidDate as Date);
    if (revenueByMonth.has(key)) {
      revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + inv.total);
    }
  }
  const revenueSeries: RevenuePoint[] = Array.from(revenueByMonth.entries()).map(([month, revenue]) => ({
    month,
    revenue,
  }));

  // ----- Shared: active subscription -> plan name, for every customer touched above -----
  const outstandingCustomerIds = outstandingInvoices
    .map((inv) => (inv.customer as unknown as { _id: string })?._id)
    .filter(Boolean);
  const topPeriodCustomerIds = currentPeriodInvoices
    .map((inv) => (inv.customer as unknown as { _id: string })?._id)
    .filter(Boolean);
  const allCustomerIds = [...outstandingCustomerIds, ...topPeriodCustomerIds];

  const [activeSubs, usageRecords] = await Promise.all([
    Subscription.find({ customer: { $in: allCustomerIds }, status: "ACTIVE" }).populate("plan").lean(),
    UsageRecord.find({
      customer: { $in: outstandingCustomerIds },
      periodMonth: { $in: outstandingInvoices.map((i) => i.periodMonth) },
    }).lean(),
  ]);
  const planByCustomer = new Map(
    activeSubs.map((s) => [s.customer.toString(), (s.plan as unknown as { name: string })?.name ?? ""])
  );
  const usageByCustomerPeriod = new Map(
    usageRecords.map((u) => [`${u.customer.toString()}|${u.periodMonth}`, u.volumeDataBytes ?? 0])
  );

  // ----- Top customers this period (by billed amount) -----
  const totalsByCustomer = new Map<string, { name: string; code: string; total: number }>();
  for (const inv of currentPeriodInvoices) {
    const customer = inv.customer as unknown as { _id: string; name: string; customerCode?: string } | null;
    if (!customer) continue;
    const key = customer._id.toString();
    const existing = totalsByCustomer.get(key) ?? { name: customer.name, code: customer.customerCode ?? "", total: 0 };
    existing.total += inv.total;
    totalsByCustomer.set(key, existing);
  }
  const topCustomers: TopCustomerRow[] = Array.from(totalsByCustomer.entries())
    .map(([id, v]) => ({
      id,
      name: v.name,
      customerCode: v.code,
      planName: planByCustomer.get(id) ?? "",
      total: v.total,
      currency: "MYR",
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // ----- Outstanding bills table -----
  const outstandingBills: OutstandingBillRow[] = outstandingInvoices.map((inv) => {
    const customer = inv.customer as unknown as {
      _id: string;
      name: string;
      customerCode?: string;
      vendor?: string;
      cardName?: string;
    } | null;
    const customerId = customer?._id?.toString() ?? "";
    return {
      id: inv._id.toString(),
      invoiceNumber: inv.invoiceNumber,
      customerId,
      customerName: customer?.name ?? "Unknown",
      customerCode: customer?.customerCode ?? "",
      planName: planByCustomer.get(customerId) ?? "--",
      vendor: customer?.vendor ?? "--",
      cardName: customer?.cardName ?? "--",
      periodMonth: inv.periodMonth,
      usageGB: Math.round(((usageByCustomerPeriod.get(`${customerId}|${inv.periodMonth}`) ?? 0) / GB) * 100) / 100,
      total: inv.total,
      currency: inv.currency ?? "MYR",
      status: inv.status as "DUE" | "OVERDUE",
    };
  });

  // ----- Revenue by plan (this month's collections) -----
  const planTotals = new Map<string, number>();
  for (const inv of planRevenueAgg) {
    const plan = (inv.subscription as unknown as { plan: { name: string } | null })?.plan;
    const name = plan?.name ?? "No Plan";
    planTotals.set(name, (planTotals.get(name) ?? 0) + inv.total);
  }
  const revenueByPlan = Array.from(planTotals.entries())
    .map(([planName, total]) => ({ planName, total, currency: "MYR" }))
    .sort((a, b) => b.total - a.total);

  // ----- Revenue by usage type (this month's collections, from line item descriptions) -----
  const typeTotals = new Map<string, number>();
  const addType = (label: string, amount: number) => typeTotals.set(label, (typeTotals.get(label) ?? 0) + amount);
  for (const inv of planRevenueAgg) {
    for (const li of inv.lineItems) {
      if (li.description.includes("Data Overage")) addType("Data Overage", li.amount);
      else if (li.description.includes("Voice Overage")) addType("Voice Overage", li.amount);
      else if (li.description.includes("Monthly Subscription")) addType("Plan Subscriptions", li.amount);
      else addType("Other", li.amount);
    }
  }
  const revenueByUsageType = Array.from(typeTotals.entries())
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);

  // ----- Billing cycle: days remaining in the current calendar month -----
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const billingCycleDaysLeft = Math.max(
    0,
    Math.ceil((endOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );

  return {
    monthlyRevenue: monthlyRevenueAgg[0]?.total ?? 0,
    monthlyRevenuePrevMonth: prevMonthRevenueAgg[0]?.total ?? 0,
    outstandingCount: outstandingAgg[0]?.count ?? 0,
    outstandingAmount: outstandingAgg[0]?.total ?? 0,
    totalCustomers,
    totalCustomersPrevMonth,
    activeCustomers,
    activeRate: totalCustomers > 0 ? (activeCustomers / totalCustomers) * 100 : 0,
    billingCycleDaysLeft,
    lastCdrBatch: lastBatch
      ? {
          fileName: lastBatch.fileName,
          status: lastBatch.status,
          createdAt: (lastBatch.createdAt as Date | undefined)?.toISOString() ?? "",
          matchedRows: lastBatch.matchedRows,
        }
      : null,
    revenueSeries,
    topCustomers,
    outstandingBills,
    revenueByPlan,
    revenueByUsageType,
  };
}
