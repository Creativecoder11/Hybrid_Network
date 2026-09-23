import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { User, CUSTOMER_PROFILE_FILTER } from "@/models/User";
import { CustomerAccount } from "@/models/CustomerAccount";
import { Subscription } from "@/models/Subscription";
import { ServicePlan } from "@/models/ServicePlan";
import { UsageRecord } from "@/models/UsageRecord";
import { Invoice } from "@/models/Invoice";
import { CdrRecord } from "@/models/CdrRecord";
import { ActivityLog } from "@/models/ActivityLog";
import { getCurrentUser } from "@/lib/auth/dal";
import { toCustomerRow } from "@/lib/admin/customerRows";
import { CustomerDetailClient } from "@/components/admin/CustomerDetailClient";
import type {
  ActivityLogRow,
  CdrRecordRow,
  CustomerAccountRow,
  CustomerDetail,
  InvoiceRow,
  PlanOption,
  PortalUserRow,
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
  if (!isValidObjectId(id)) notFound();
  const currentUser = await getCurrentUser();

  await connectDB();
  const customer = await User.findOne({ _id: id, ...CUSTOMER_PROFILE_FILTER }).lean();
  if (!customer) notFound();

  const [accounts, subs, usageRecords, invoices, cdrRecords, activity, allPlans, extraUsers] = await Promise.all([
    CustomerAccount.find({ customer: id }).sort({ createdAt: 1 }).lean(),
    Subscription.find({ customer: id }).populate("plan").sort({ createdAt: -1 }).lean(),
    UsageRecord.find({ customer: id }).sort({ periodMonth: -1 }).lean(),
    Invoice.find({ customer: id }).sort({ issueDate: -1 }).lean(),
    CdrRecord.find({ customer: id }).sort({ startCdr: -1 }).limit(200).lean(),
    ActivityLog.find({ targetCustomer: id }).sort({ createdAt: -1 }).limit(100).populate("actor").lean(),
    ServicePlan.find({ isActive: true }).sort({ name: 1 }).lean(),
    User.find({ role: "CUSTOMER", customerProfile: id }).sort({ createdAt: 1 }).lean(),
  ]);

  const accountNumberById = new Map(accounts.map((a) => [a._id.toString(), a.accountNumber]));
  const accountLabel = (accountId: unknown) => (accountId ? (accountNumberById.get(String(accountId)) ?? "") : "");

  const activeSubByAccount = new Map<string, (typeof subs)[number]>();
  for (const s of subs) {
    if (s.status === "ACTIVE" && s.customerAccount && !activeSubByAccount.has(s.customerAccount.toString())) {
      activeSubByAccount.set(s.customerAccount.toString(), s);
    }
  }
  const invoiceCountByAccount = new Map<string, number>();
  for (const inv of invoices) {
    const key = inv.customerAccount?.toString();
    if (key) invoiceCountByAccount.set(key, (invoiceCountByAccount.get(key) ?? 0) + 1);
  }

  const accountRows: CustomerAccountRow[] = accounts.map((a) => {
    const sub = activeSubByAccount.get(a._id.toString());
    const plan = sub?.plan as unknown as { _id: { toString(): string }; name: string } | null;
    return {
      id: a._id.toString(),
      accountNumber: a.accountNumber,
      name: a.name ?? "",
      status: a.status ?? "ACTIVE",
      starlinkVesselIds: a.starlinkVesselIds ?? [],
      slashAccountNumber: a.slashAccountNumber ?? "",
      iccids: a.iccids ?? [],
      cardName: a.cardName ?? "",
      allowedProductCodes: a.allowedProductCodes ?? [],
      notes: a.notes ?? "",
      planId: plan?._id.toString() ?? "",
      planName: plan?.name ?? "",
      staticIp: sub?.staticIp ?? "",
      invoiceCount: invoiceCountByAccount.get(a._id.toString()) ?? 0,
      createdAt: (a.createdAt as Date | undefined)?.toISOString() ?? "",
    };
  });

  const now = new Date().getTime();
  const toPortalUser = (u: typeof customer, isPrimary: boolean): PortalUserRow => ({
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    phone: u.phone ?? "",
    status: u.status,
    isPrimary,
    mustChangePassword: Boolean(u.mustChangePassword),
    tempPasswordExpiresAt: u.tempPasswordExpiresAt ? (u.tempPasswordExpiresAt as Date).toISOString() : null,
    invitationExpired:
      u.status === "INVITED" && Boolean(u.tempPasswordExpiresAt) && (u.tempPasswordExpiresAt as Date).getTime() < now,
    lastLoginAt: u.lastLoginAt ? (u.lastLoginAt as Date).toISOString() : null,
    accountAccessAll: u.accountAccessAll !== false,
    accountAccess: (u.accountAccess ?? []).map((x) => x.toString()),
    createdAt: (u.createdAt as Date | undefined)?.toISOString() ?? "",
  });
  const portalUsers: PortalUserRow[] = [toPortalUser(customer, true), ...extraUsers.map((u) => toPortalUser(u, false))];

  const firstAccountSub = accounts[0] ? activeSubByAccount.get(accounts[0]._id.toString()) : undefined;
  const firstPlan = firstAccountSub?.plan as unknown as { _id: { toString(): string }; name: string } | null;
  const currentPeriod = (() => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  const detail: CustomerDetail = {
    ...toCustomerRow(customer, {
      accountNumbers: accounts.map((a) => a.accountNumber),
      plan: firstPlan ? { planId: firstPlan._id.toString(), planName: firstPlan.name, staticIp: firstAccountSub?.staticIp ?? "" } : null,
      usage: usageRecords.find((u) => u.periodMonth === currentPeriod) ?? null,
      starlinkVesselId: customer.starlinkVesselId || accounts[0]?.starlinkVesselIds?.[0] || null,
    }),
    mustChangePassword: Boolean(customer.mustChangePassword),
    tempPasswordExpiresAt: customer.tempPasswordExpiresAt ? (customer.tempPasswordExpiresAt as Date).toISOString() : null,
    subscriptions: subs.map(
      (s): SubscriptionRow => ({
        id: s._id.toString(),
        accountNumber: accountLabel(s.customerAccount),
        planName: (s.plan as unknown as { name: string } | null)?.name ?? "Unknown plan",
        planProvider: (s.plan as unknown as { provider: string } | null)?.provider ?? "",
        monthlyPrice: (s.plan as unknown as { monthlyPrice: number } | null)?.monthlyPrice ?? 0,
        currency: (s.plan as unknown as { currency: string } | null)?.currency ?? "USD",
        status: s.status,
        startDate: (s.startDate as Date | undefined)?.toISOString() ?? "",
        endDate: s.endDate ? (s.endDate as Date).toISOString() : null,
        staticIp: s.staticIp ?? "",
        terminalIds: s.terminalIds ?? [],
      })
    ),
  };

  const usageHistory: UsageHistoryRow[] = usageRecords.map((u) => ({
    accountId: u.customerAccount?.toString() ?? "",
    accountNumber: accountLabel(u.customerAccount),
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
    currency: u.currency ?? "USD",
  }));

  const invoiceRows: InvoiceRow[] = invoices.map((inv) => ({
    id: inv._id.toString(),
    invoiceNumber: inv.invoiceNumber,
    accountNumber: inv.accountNumber || accountLabel(inv.customerAccount),
    periodMonth: inv.periodMonth,
    issueDate: (inv.issueDate as Date).toISOString(),
    dueDate: (inv.dueDate as Date).toISOString(),
    total: inv.total,
    currency: inv.currency ?? "USD",
    status: inv.status,
  }));

  const cdrRows: CdrRecordRow[] = cdrRecords.map((r) => ({
    id: r._id.toString(),
    cdrId: r.cdrId,
    accountNumber: accountLabel(r.customerAccount),
    productCode: r.prod ?? "",
    startCdr: r.startCdr ? (r.startCdr as Date).toISOString() : null,
    period: r.period,
    volumeDataGB: toGB(r.volumeDataBytes),
    volumeTotalGB: toGB(r.volumeTotalBytes),
    cardName: r.cardName ?? "",
    service: r.service ?? "",
    priceTotal: r.priceTotal ?? 0,
    currency: r.priceCurrency ?? "USD",
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
      accounts={accountRows}
      portalUsers={portalUsers}
      usageHistory={usageHistory}
      invoices={invoiceRows}
      cdrRecords={cdrRows}
      activity={activityRows}
      plans={plans}
      canDelete={currentUser?.role === "SUPER_ADMIN"}
    />
  );
}
