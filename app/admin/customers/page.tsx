import type { Metadata } from "next";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/models/User";
import { Subscription } from "@/models/Subscription";
import { ServicePlan } from "@/models/ServicePlan";
import { Invoice } from "@/models/Invoice";
import { UsageRecord } from "@/models/UsageRecord";
import { getCurrentUser } from "@/lib/auth/dal";
import { CustomersPageClient } from "@/components/admin/CustomersPageClient";
import type { CustomerRow, PlanOption } from "@/lib/types/admin";

export const metadata: Metadata = {
  title: "Customers | Hybrid Networks Admin",
};

const GB = 1_000_000_000;
const toGB = (bytes: number | null | undefined) => Math.round(((bytes ?? 0) / GB) * 100) / 100;

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

  const filter: Record<string, unknown> = { role: "CUSTOMER" };
  if (status !== "ALL") filter.status = status;
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
      { customerId: { $regex: q, $options: "i" } },
      { customerCode: { $regex: q, $options: "i" } },
      { phone: { $regex: q, $options: "i" } },
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

  const [subs, usageRecords] = await Promise.all([
    Subscription.find({ customer: { $in: customerIds }, status: "ACTIVE" }).populate("plan").lean(),
    UsageRecord.find({ customer: { $in: customerIds }, periodMonth }).lean(),
  ]);

  const subByCustomer = new Map<string, { planId: string; planName: string; staticIp: string }>();
  for (const s of subs) {
    const plan = s.plan as unknown as { _id: string; name: string } | null;
    if (plan) {
      subByCustomer.set(s.customer.toString(), {
        planId: plan._id.toString(),
        planName: plan.name,
        staticIp: s.staticIp ?? "",
      });
    }
  }

  const usageByCustomer = new Map<string, (typeof usageRecords)[number]>();
  for (const u of usageRecords) usageByCustomer.set(u.customer.toString(), u);

  const rows: CustomerRow[] = customers.map((c) => {
    const sub = subByCustomer.get(c._id.toString());
    const usage = usageByCustomer.get(c._id.toString());
    return {
      id: c._id.toString(),
      name: c.name,
      email: c.email,
      phone: c.phone ?? "",
      address: c.address ?? "",
      company: c.company ?? "",
      customerId: c.customerId ?? "",
      customerCode: c.customerCode ?? "",
      status: c.status,
      createdAt: (c.createdAt as Date | undefined)?.toISOString() ?? "",
      accountType: c.accountType ?? null,
      contactPerson: c.contactPerson ?? "",
      nidTradeLicense: c.nidTradeLicense ?? "",
      cardName: c.cardName ?? "",
      iccid: c.iccid ?? "",
      imei: c.imei ?? "",
      service: c.service ?? "",
      vendor: c.vendor ?? "",
      starlinkVesselId: c.starlinkVesselId ?? "",
      starlinkServiceLineNumber: c.starlinkServiceLineNumber ?? "",
      network: {
        originNumber: c.network?.originNumber ?? "",
        originCountry: c.network?.originCountry ?? "",
        originIpAddress: c.network?.originIpAddress ?? "",
        originRegion: c.network?.originRegion ?? "",
        originState: c.network?.originState ?? "",
        destinationNumber: c.network?.destinationNumber ?? "",
        destinationNetwork: c.network?.destinationNetwork ?? "",
        destinationCountry: c.network?.destinationCountry ?? "",
        destinationState: c.network?.destinationState ?? "",
      },
      planId: sub?.planId ?? "",
      planName: sub?.planName ?? "",
      staticIp: sub?.staticIp ?? "",
      usage: usage
        ? {
            volumeDataGB: toGB(usage.volumeDataBytes),
            volumeMin: usage.volumeMin ?? 0,
            volumeMsg: usage.volumeMsg ?? 0,
            volumeInBundleGB: toGB(usage.volumeInBundleBytes),
            volumeOutBundleGB: toGB(usage.volumeOutBundleBytes),
            volumeTotalGB: toGB(usage.volumeTotalBytes),
            consumptionMoney: usage.consumptionMoney ?? 0,
            consumptionDataGB: toGB(usage.consumptionDataBytes),
            consumptionMin: usage.consumptionMin ?? 0,
            consumptionMsg: usage.consumptionMsg ?? 0,
          }
        : null,
    };
  });

  // ----- Stat cards -----
  const [totalCustomers, activeCount, suspendedCount, overdueAgg] = await Promise.all([
    User.countDocuments({ role: "CUSTOMER" }),
    User.countDocuments({ role: "CUSTOMER", status: "ACTIVE" }),
    User.countDocuments({ role: "CUSTOMER", status: "SUSPENDED" }),
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
