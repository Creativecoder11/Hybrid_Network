import type { Metadata } from "next";
import { connectDB } from "@/lib/db/connect";
import { User, CUSTOMER_PROFILE_FILTER } from "@/models/User";
import { CustomerAccount } from "@/models/CustomerAccount";
import { Subscription } from "@/models/Subscription";
import { ServicePlan } from "@/models/ServicePlan";
import { Invoice } from "@/models/Invoice";
import { UsageRecord } from "@/models/UsageRecord";
import { getCurrentUser } from "@/lib/auth/dal";
import { CustomersPageClient } from "@/components/admin/CustomersPageClient";
import { toCustomerRow, escapeRegex } from "@/lib/admin/customerRows";
import type { CustomerRow, PlanOption } from "@/lib/types/admin";

export const metadata: Metadata = {
  title: "Customers | Hybrid Networks Admin",
};

function currentPeriodMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = typeof sp.status === "string" ? sp.status : "ALL";
  const sort = typeof sp.sort === "string" ? sp.sort : "date_desc";
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(sp.pageSize) || 20));

  const currentUser = await getCurrentUser();
  await connectDB();

  const filter: Record<string, unknown> = { ...CUSTOMER_PROFILE_FILTER };
  if (status !== "ALL") filter.status = status;
  if (q.trim()) {
    const pattern = { $regex: escapeRegex(q.trim()), $options: "i" };
    // Customer Account numbers live on CustomerAccount; include profiles
    // owning a matching account.
    const accountOwners = await CustomerAccount.find({ accountNumber: pattern }).select("customer").limit(200).lean();
    filter.$or = [
      { name: pattern },
      { email: pattern },
      { company: pattern },
      { customerId: pattern },
      { customerCode: pattern },
      { phone: pattern },
      { _id: { $in: accountOwners.map((a) => a.customer) } },
    ];
  }

  const sortSpec: Record<string, 1 | -1> =
    sort === "date_asc" ? { createdAt: 1 } : sort === "name_asc" ? { name: 1 } : { createdAt: -1 };

  const [total, customers, allPlans] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .sort(sortSpec)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    ServicePlan.find({ isActive: true }).sort({ name: 1 }).lean(),
  ]);

  const customerIds = customers.map((c) => c._id);
  const periodMonth = currentPeriodMonth();

  const [accounts, subs, usageRecords] = await Promise.all([
    CustomerAccount.find({ customer: { $in: customerIds } }).select("customer accountNumber").sort({ createdAt: 1 }).lean(),
    Subscription.find({ customer: { $in: customerIds }, status: "ACTIVE" }).populate("plan").sort({ createdAt: 1 }).lean(),
    UsageRecord.find({ customer: { $in: customerIds }, periodMonth }).lean(),
  ]);

  const accountsByCustomer = new Map<string, string[]>();
  for (const a of accounts) {
    const key = a.customer.toString();
    accountsByCustomer.set(key, [...(accountsByCustomer.get(key) ?? []), a.accountNumber]);
  }

  const subByCustomer = new Map<string, { planId: string; planName: string; staticIp: string }>();
  for (const s of subs) {
    const plan = s.plan as unknown as { _id: string; name: string } | null;
    if (plan && !subByCustomer.has(s.customer.toString())) {
      subByCustomer.set(s.customer.toString(), {
        planId: plan._id.toString(),
        planName: plan.name,
        staticIp: s.staticIp ?? "",
      });
    }
  }

  const usageByCustomer = new Map<string, (typeof usageRecords)[number]>();
  for (const u of usageRecords) {
    if (!usageByCustomer.has(u.customer.toString())) usageByCustomer.set(u.customer.toString(), u);
  }

  const rows: CustomerRow[] = customers.map((c) =>
    toCustomerRow(c, {
      accountNumbers: accountsByCustomer.get(c._id.toString()) ?? [],
      plan: subByCustomer.get(c._id.toString()) ?? null,
      usage: usageByCustomer.get(c._id.toString()) ?? null,
    })
  );

  // ----- Stat cards -----
  const [totalCustomers, activeCount, suspendedCount, overdueAgg] = await Promise.all([
    User.countDocuments(CUSTOMER_PROFILE_FILTER),
    User.countDocuments({ ...CUSTOMER_PROFILE_FILTER, status: "ACTIVE" }),
    User.countDocuments({ ...CUSTOMER_PROFILE_FILTER, status: "SUSPENDED" }),
    Invoice.aggregate([
      { $match: { status: "OVERDUE" } },
      { $group: { _id: "$customer", total: { $sum: "$total" } } },
    ]),
  ]);

  const overdueCount = overdueAgg.length;
  const overdueAmount = overdueAgg.reduce((sum, g) => sum + (g.total ?? 0), 0);

  const stats = {
    total: totalCustomers,
    active: activeCount,
    activeRate: totalCustomers > 0 ? (activeCount / totalCustomers) * 100 : 0,
    overdueCount,
    overdueAmount,
    suspended: suspendedCount,
    suspendedRate: totalCustomers > 0 ? (suspendedCount / totalCustomers) * 100 : 0,
  };

  const plans: PlanOption[] = allPlans.map((p) => ({
    id: p._id.toString(),
    name: p.name,
    provider: p.provider,
    monthlyPrice: p.monthlyPrice,
    currency: p.currency,
    sharedRatio: p.sharedRatio ?? "",
    speedMbps: p.speedMbps ?? null,
  }));

  return (
    <CustomersPageClient
      rows={rows}
      total={total}
      page={page}
      pageSize={pageSize}
      q={q}
      status={status}
      sort={sort}
      stats={stats}
      plans={plans}
      canDelete={currentUser?.role === "SUPER_ADMIN"}
    />
  );
}
