import "server-only";
import { connectDB } from "@/lib/db/connect";
import { Subscription } from "@/models/Subscription";
import { UsageRecord } from "@/models/UsageRecord";
import { getVessel } from "@/lib/starlink/vessels";
import { getVesselServicePlan } from "@/lib/starlink/service-plans";
import { getVesselDataUsage, getVesselDataUsageHistory } from "@/lib/starlink/usage";
import { describeStarlinkError, friendlyStarlinkErrorMessage } from "@/lib/starlink/client";
import type { PortalAccount } from "@/lib/accounts/access";
import type {
  PortalDailyUsageRow,
  PortalPlanInfo,
  PortalServiceLinePlan,
  PortalUsageHistoryRow,
  PortalUsageInfo,
} from "@/lib/types/portal";

// Account-scoped portal data. Callers pass the account from a PortalContext,
// which has already been authorized for the logged-in user.

const GB = 1_000_000_000;
const toGB = (bytes: number | null | undefined) => Math.round(((bytes ?? 0) / GB) * 100) / 100;

export function currentPeriodMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function daysInMonth(periodMonth: string): number {
  const year = Number(periodMonth.slice(0, 4));
  const month = Number(periodMonth.slice(4, 6));
  return new Date(year, month, 0).getDate();
}

export function dayOfMonthOrFull(periodMonth: string): number {
  const now = new Date();
  const isCurrentMonth = currentPeriodMonth() === periodMonth;
  return isCurrentMonth ? now.getDate() : daysInMonth(periodMonth);
}

/** Hybrid Networks subscription on the account (database). */
export async function getActivePlanInfo(accountId: string): Promise<PortalPlanInfo | null> {
  await connectDB();
  const subscription = await Subscription.findOne({ customerAccount: accountId, status: "ACTIVE" })
    .sort({ createdAt: -1 })
    .populate("plan");
  if (!subscription) return null;

  const plan = subscription.plan as unknown as {
    name: string;
    provider: string;
    monthlyPrice: number;
    currency: string;
    dataAllowanceGB: number | null;
    voiceMinutes: number | null;
    smsCount: number | null;
    speedMbps: number | null;
    sharedRatio: string;
  } | null;
  if (!plan) return null;

  return {
    planName: plan.name,
    provider: plan.provider,
    monthlyPrice: plan.monthlyPrice,
    currency: plan.currency,
    dataAllowanceGB: plan.dataAllowanceGB ?? null,
    voiceMinutes: plan.voiceMinutes ?? null,
    smsCount: plan.smsCount ?? null,
    speedMbps: plan.speedMbps ?? null,
    sharedRatio: plan.sharedRatio ?? "",
    staticIp: subscription.staticIp ?? "",
    subscriptionStatus: subscription.status,
    startDate: subscription.startDate?.toISOString() ?? "",
    terminalIds: subscription.terminalIds ?? [],
  };
}

/** CDR-derived usage for one month (database). */
export async function getUsageForPeriod(accountId: string, periodMonth: string): Promise<PortalUsageInfo | null> {
  await connectDB();
  const usage = await UsageRecord.findOne({ customerAccount: accountId, periodMonth });
  if (!usage) return null;

  const dayCount = dayOfMonthOrFull(periodMonth);
  const dataGB = toGB(usage.volumeDataBytes);

  return {
    periodMonth,
    volumeDataGB: dataGB,
    volumeMin: usage.volumeMin ?? 0,
    volumeMsg: usage.volumeMsg ?? 0,
    volumeInBundleGB: toGB(usage.volumeInBundleBytes),
    dailyAverageGB: dayCount > 0 ? Math.round((dataGB / dayCount) * 100) / 100 : 0,
  };
}

/** Last 12 months of CDR-derived usage for the account (database). */
export async function getUsageHistory(accountId: string): Promise<PortalUsageHistoryRow[]> {
  await connectDB();
  const since = new Date();
  since.setMonth(since.getMonth() - 12);
  const cutoff = `${since.getFullYear()}${String(since.getMonth() + 1).padStart(2, "0")}`;
  const records = await UsageRecord.find({ customerAccount: accountId, periodMonth: { $gte: cutoff } })
    .sort({ periodMonth: 1 })
    .lean();
  return records.map((r) => ({
    periodMonth: r.periodMonth,
    volumeDataGB: toGB(r.volumeDataBytes),
    volumeMin: r.volumeMin ?? 0,
  }));
}

function nullableNumber(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Starlink service-line plan + current-cycle usage for each of the account's vessels (SLASH). */
export async function getServiceLinePlans(account: PortalAccount): Promise<PortalServiceLinePlan[]> {
  return Promise.all(
    account.starlinkVesselIds.map(async (vesselId): Promise<PortalServiceLinePlan> => {
      const [vessel, plan, usage] = await Promise.allSettled([
        getVessel(vesselId),
        getVesselServicePlan(vesselId),
        getVesselDataUsage(vesselId),
      ]);
      const v = vessel.status === "fulfilled" ? vessel.value : null;
      const p = plan.status === "fulfilled" ? plan.value : null;
      const u = usage.status === "fulfilled" ? usage.value : null;
      const firstError = [vessel, plan, usage].find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
      if (firstError) console.error(`[portal] SLASH plan/usage for ${vesselId}: ${describeStarlinkError(firstError.reason)}`);

      return {
        vesselId,
        serviceLineNumber: v?.serviceLineNumber ?? "",
        displayName: v?.serviceLineNickname || v?.vesselName || "Starlink service line",
        serviceLineActive: v ? v.serviceLineActive : null,
        planName: p?.planName ?? null,
        allocatedDataGB: nullableNumber(p?.allocatedDataGB),
        priorityDataGB: nullableNumber(p?.priorityDataGB),
        standardDataGB: nullableNumber(p?.standardDataGB),
        blockDataGB: nullableNumber(p?.blockDataGB),
        topUpDataGB: nullableNumber(p?.topUpDataGB),
        isOptedIntoOverage: p ? p.isOptedIntoOverage : null,
        overageName: p?.overageName ?? null,
        autoRenew: p?.autoRenew ?? null,
        billingCycleStart: p?.billingCycleStart ?? u?.billingCycleStart ?? null,
        billingCycleEnd: p?.billingCycleEnd ?? u?.billingCycleEnd ?? null,
        currentActivationDate: p?.currentActivationDate ?? null,
        subscriptionEndDate: p?.subscriptionEndDate ?? null,
        usage: u
          ? {
              priorityGB: u.priorityGB,
              standardGB: u.standardGB,
              optInPriorityGB: u.optInPriorityGB,
              nonBillableGB: u.nonBillableGB,
              totalGB: u.totalGB,
              billingCycleStart: u.billingCycleStart,
              billingCycleEnd: u.billingCycleEnd,
              lastUpdatedAt: u.lastUpdatedAt ?? null,
            }
          : null,
        error: firstError ? friendlyStarlinkErrorMessage(firstError.reason) : null,
      };
    })
  );
}

/** Daily usage for the last `days` days (max 60), summed across the account's service lines (SLASH). */
export async function getDailyUsage(
  account: PortalAccount,
  days = 30
): Promise<{ rows: PortalDailyUsageRow[]; error: string | null }> {
  if (account.starlinkVesselIds.length === 0) return { rows: [], error: null };
  const end = new Date();
  const start = new Date(end.getTime() - Math.min(days, 60) * 24 * 60 * 60 * 1000);

  const results = await Promise.allSettled(
    account.starlinkVesselIds.map((id) => getVesselDataUsageHistory(id, { startDate: start, endDate: end }))
  );
  const byDate = new Map<string, PortalDailyUsageRow>();
  let error: string | null = null;
  for (const r of results) {
    if (r.status === "rejected") {
      console.error(`[portal] SLASH usage history: ${describeStarlinkError(r.reason)}`);
      error = friendlyStarlinkErrorMessage(r.reason);
      continue;
    }
    for (const p of r.value) {
      const date = p.date.slice(0, 10);
      const row = byDate.get(date) ?? { date, priorityGB: 0, standardGB: 0, nonBillableGB: 0, totalGB: 0 };
      row.priorityGB += p.priorityGB;
      row.standardGB += p.standardGB;
      row.nonBillableGB += p.nonBillableGB;
      row.totalGB += p.totalGB;
      byDate.set(date, row);
    }
  }
  const rows = Array.from(byDate.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({
      date: r.date,
      priorityGB: Math.round(r.priorityGB * 100) / 100,
      standardGB: Math.round(r.standardGB * 100) / 100,
      nonBillableGB: Math.round(r.nonBillableGB * 100) / 100,
      totalGB: Math.round(r.totalGB * 100) / 100,
    }));
  return { rows, error };
}
