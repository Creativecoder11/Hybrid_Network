import type { Metadata } from "next";
import { connectDB } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import { User } from "@/models/User";
import { Subscription } from "@/models/Subscription";
import { UsageRecord } from "@/models/UsageRecord";
import { syncOverdueStatuses } from "@/lib/billing/statusSync";
import { getBillingStats, buildPlanSpecLabel } from "@/lib/billing/billingStats";
import { BillingPageClient } from "@/components/admin/BillingPageClient";
import type { BillableCustomerOption, InvoiceListRow } from "@/lib/types/billing";

const GB = 1_000_000_000;

export const metadata: Metadata = {
  title: "Billing | Hybrid Networks Admin",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "ALL";
  const customerId = typeof sp.customerId === "string" ? sp.customerId : "";
  const period = typeof sp.period === "string" ? sp.period : "";
  const q = typeof sp.q === "string" ? sp.q : "";
  const sort = typeof sp.sort === "string" ? sp.sort : "date_desc";

  await syncOverdueStatuses();
  await connectDB();

  const filter: Record<string, unknown> = {};
  if (status !== "ALL") filter.status = status;
  if (customerId) filter.customer = customerId;
  if (period) filter.periodMonth = period;

  const sortSpec: Record<string, 1 | -1> =
    sort === "date_asc"
      ? { issueDate: 1 }
      : sort === "amount_desc"
        ? { total: -1 }
        : sort === "amount_asc"
          ? { total: 1 }
          : { issueDate: -1 };

  const [invoices, stats, customers] = await Promise.all([
    Invoice.find(filter).sort(sortSpec).limit(200).populate("customer").lean(),
    getBillingStats(),
    User.find({ role: "CUSTOMER" }).sort({ name: 1 }).lean(),
  ]);

  const activeSubs = await Subscription.find({
    customer: { $in: customers.map((c) => c._id) },
    status: "ACTIVE",
  })
    .populate("plan")
    .lean();

  const planByCustomer = new Map(
    activeSubs.map((s) => [s.customer.toString(), s.plan as unknown as Record<string, unknown>])
  );

  const usageRecords = await UsageRecord.find({
    customer: { $in: customers.map((c) => c._id) },
  }).lean();
  const usageByCustomerPeriod = new Map(
    usageRecords.map((u) => [`${u.customer.toString()}|${u.periodMonth}`, u.volumeDataBytes ?? 0])
  );

  let rows: InvoiceListRow[] = invoices.map((inv) => {
    const customer = inv.customer as unknown as {
      _id: string;
      name: string;
      customerCode?: string;
      vendor?: string;
      cardName?: string;
    } | null;
    const cid = customer?._id?.toString() ?? "";
    const plan = planByCustomer.get(cid) as { name?: string } | undefined;
    return {
      id: inv._id.toString(),
      invoiceNumber: inv.invoiceNumber,
      customerId: cid,
      customerName: customer?.name ?? "Unknown",
      customerCode: customer?.customerCode ?? "",
      vendor: customer?.vendor ?? "--",
      cardName: customer?.cardName ?? "--",
      planName: plan?.name ?? "--",
      usageGB: Math.round(((usageByCustomerPeriod.get(`${cid}|${inv.periodMonth}`) ?? 0) / GB) * 100) / 100,
      periodMonth: inv.periodMonth,
      issueDate: (inv.issueDate as Date).toISOString(),
      dueDate: (inv.dueDate as Date).toISOString(),
      total: inv.total,
      currency: inv.currency ?? "USD",
      status: inv.status,
    };
  });

  if (q.trim()) {
    const needle = q.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        r.invoiceNumber.toLowerCase().includes(needle) ||
        r.customerName.toLowerCase().includes(needle) ||
        r.customerCode.toLowerCase().includes(needle) ||
        r.cardName.toLowerCase().includes(needle)
    );
  }

  const customerOptions: BillableCustomerOption[] = customers
    .filter((c) => planByCustomer.has(c._id.toString()))
    .map((c) => {
      const plan = planByCustomer.get(c._id.toString()) as {
        _id: string;
        name: string;
        provider: string;
        monthlyPrice: number;
        currency: string;
        speedMbps?: number | null;
        sharedRatio?: string | null;
        dataAllowanceGB?: number | null;
      };
      return {
        id: c._id.toString(),
        label: `${c.name}${c.customerCode ? ` (${c.customerCode})` : ""}`,
        customerCode: c.customerCode ?? "",
        customerSince: (c.createdAt as Date).toISOString(),
        planId: plan._id.toString(),
        planName: plan.name,
        planProvider: plan.provider,
        planSpecLabel: buildPlanSpecLabel(plan),
        planMonthlyPrice: plan.monthlyPrice,
        planCurrency: plan.currency ?? "USD",
      };
    });

  return (
    <BillingPageClient
      rows={rows}
      status={status}
      customerId={customerId}
      period={period}
      q={q}
      sort={sort}
      stats={stats}
      customerOptions={customerOptions}
      allCustomers={customers.map((c) => ({ id: c._id.toString(), label: c.name }))}
    />
  );
}
