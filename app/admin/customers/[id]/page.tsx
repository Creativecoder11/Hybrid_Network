import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/models/User";
import { Subscription } from "@/models/Subscription";
import { ServicePlan } from "@/models/ServicePlan";
import { UsageRecord } from "@/models/UsageRecord";
import { Invoice } from "@/models/Invoice";
import { CdrRecord } from "@/models/CdrRecord";
import { ActivityLog } from "@/models/ActivityLog";
import { getCurrentUser } from "@/lib/auth/dal";
import { CustomerDetailClient } from "@/components/admin/CustomerDetailClient";
import type {
  ActivityLogRow,
  CdrRecordRow,
  CustomerDetail,
  InvoiceRow,
  PlanOption,
  SubscriptionRow,
  UsageHistoryRow,
} from "@/lib/types/admin";

export const metadata: Metadata = {
  title: "Customer Detail | Hybrid Networks Admin",
};

const GB = 1_000_000_000;
const toGB = (bytes: number | null | undefined) => Math.round(((bytes ?? 0) / GB) * 100) / 100;

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await getCurrentUser();

  await connectDB();
  const customer = await User.findOne({ _id: id, role: "CUSTOMER" }).lean();
  if (!customer) notFound();

  const [subs, usageRecords, invoices, cdrRecords, activity, allPlans] = await Promise.all([
    Subscription.find({ customer: id }).populate("plan").sort({ createdAt: -1 }).lean(),
    UsageRecord.find({ customer: id }).sort({ periodMonth: -1 }).lean(),
    Invoice.find({ customer: id }).sort({ issueDate: -1 }).lean(),
    CdrRecord.find({ customer: id }).sort({ startCdr: -1 }).limit(200).lean(),
    ActivityLog.find({ targetCustomer: id }).sort({ createdAt: -1 }).limit(100).populate("actor").lean(),
    ServicePlan.find({ isActive: true }).sort({ name: 1 }).lean(),
  ]);

  const activeSub = subs.find((s) => s.status === "ACTIVE") ?? subs[0] ?? null;
  const activePlan = activeSub?.plan as unknown as { _id: string; name: string } | null;
  const currentPeriod = (() => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();
  const currentUsage = usageRecords.find((u) => u.periodMonth === currentPeriod);

  const detail: CustomerDetail = {
    id: customer._id.toString(),
    name: customer.name,
    email: customer.email,
    phone: customer.phone ?? "",
    address: customer.address ?? "",
    company: customer.company ?? "",
    customerId: customer.customerId ?? "",
    customerCode: customer.customerCode ?? "",
    status: customer.status,
    createdAt: (customer.createdAt as Date | undefined)?.toISOString() ?? "",
    accountType: customer.accountType ?? null,
    contactPerson: customer.contactPerson ?? "",
    nidTradeLicense: customer.nidTradeLicense ?? "",
    cardName: customer.cardName ?? "",
    iccid: customer.iccid ?? "",
    imei: customer.imei ?? "",
    service: customer.service ?? "",
    vendor: customer.vendor ?? "",
    network: {
      originNumber: customer.network?.originNumber ?? "",
      originCountry: customer.network?.originCountry ?? "",
      originIpAddress: customer.network?.originIpAddress ?? "",
      originRegion: customer.network?.originRegion ?? "",
      originState: customer.network?.originState ?? "",
      destinationNumber: customer.network?.destinationNumber ?? "",
      destinationNetwork: customer.network?.destinationNetwork ?? "",
      destinationCountry: customer.network?.destinationCountry ?? "",
      destinationState: customer.network?.destinationState ?? "",
    },
    planId: activePlan?._id?.toString() ?? "",
    planName: activePlan?.name ?? "",
    staticIp: activeSub?.staticIp ?? "",
    usage: currentUsage
      ? {
          volumeDataGB: toGB(currentUsage.volumeDataBytes),
          volumeMin: currentUsage.volumeMin ?? 0,
          volumeMsg: currentUsage.volumeMsg ?? 0,
          volumeInBundleGB: toGB(currentUsage.volumeInBundleBytes),
          volumeOutBundleGB: toGB(currentUsage.volumeOutBundleBytes),
          volumeTotalGB: toGB(currentUsage.volumeTotalBytes),
          consumptionMoney: currentUsage.consumptionMoney ?? 0,
          consumptionDataGB: toGB(currentUsage.consumptionDataBytes),
          consumptionMin: currentUsage.consumptionMin ?? 0,
          consumptionMsg: currentUsage.consumptionMsg ?? 0,
        }
      : null,
    subscriptions: subs.map(
      (s): SubscriptionRow => ({
        id: s._id.toString(),
        planName: (s.plan as unknown as { name: string } | null)?.name ?? "Unknown plan",
        planProvider: (s.plan as unknown as { provider: string } | null)?.provider ?? "",
        monthlyPrice: (s.plan as unknown as { monthlyPrice: number } | null)?.monthlyPrice ?? 0,
        currency: (s.plan as unknown as { currency: string } | null)?.currency ?? "MYR",
        status: s.status,
        startDate: (s.startDate as Date | undefined)?.toISOString() ?? "",
        endDate: s.endDate ? (s.endDate as Date).toISOString() : null,
        staticIp: s.staticIp ?? "",
        terminalIds: s.terminalIds ?? [],
      })
    ),
  };

  const usageHistory: UsageHistoryRow[] = usageRecords.map((u) => ({
    periodMonth: u.periodMonth,
    volumeDataGB: toGB(u.volumeDataBytes),
    volumeMin: u.volumeMin ?? 0,
    volumeMsg: u.volumeMsg ?? 0,
    volumeInBundleGB: toGB(u.volumeInBundleBytes),
    volumeOutBundleGB: toGB(u.volumeOutBundleBytes),
    volumeTotalGB: toGB(u.volumeTotalBytes),
    consumptionMoney: u.consumptionMoney ?? 0,
    consumptionDataGB: toGB(u.consumptionDataBytes),
    consumptionMin: u.consumptionMin ?? 0,
    consumptionMsg: u.consumptionMsg ?? 0,
    source: u.source,
    currency: u.currency ?? "MYR",
  }));

  const invoiceRows: InvoiceRow[] = invoices.map((inv) => ({
    id: inv._id.toString(),
    invoiceNumber: inv.invoiceNumber,
    periodMonth: inv.periodMonth,
    issueDate: (inv.issueDate as Date).toISOString(),
    dueDate: (inv.dueDate as Date).toISOString(),
    total: inv.total,
    currency: inv.currency ?? "MYR",
    status: inv.status,
  }));

  const cdrRows: CdrRecordRow[] = cdrRecords.map((r) => ({
    id: r._id.toString(),
    cdrId: r.cdrId,
    startCdr: r.startCdr ? (r.startCdr as Date).toISOString() : null,
    period: r.period,
    volumeDataGB: toGB(r.volumeDataBytes),
    volumeTotalGB: toGB(r.volumeTotalBytes),
    cardName: r.cardName ?? "",
    service: r.service ?? "",
    priceTotal: r.priceTotal ?? 0,
    currency: r.priceCurrency ?? "MYR",
  }));

  const activityRows: ActivityLogRow[] = activity.map((a) => ({
    id: a._id.toString(),
    actorName: (a.actor as unknown as { name: string } | null)?.name ?? "System",
    action: a.action,
    meta: (a.meta as Record<string, unknown>) ?? {},
    createdAt: (a.createdAt as Date | undefined)?.toISOString() ?? "",
  }));

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
    <CustomerDetailClient
      customer={detail}
      usageHistory={usageHistory}
      invoices={invoiceRows}
      cdrRecords={cdrRows}
      activity={activityRows}
      plans={plans}
      canDelete={currentUser?.role === "SUPER_ADMIN"}
    />
  );
}
