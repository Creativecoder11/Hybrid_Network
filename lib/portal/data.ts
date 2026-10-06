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

      let usageInfo = u;
      if (usageInfo && usageInfo.totalGB === 0) {
        try {
          const hist = await getVesselDataUsageHistory(vesselId);
          if (hist.length > 0) {
            const histPriority = hist.reduce((s, p) => s + (p.priorityGB || 0), 0);
            const histStandard = hist.reduce((s, p) => s + (p.standardGB || 0), 0);
            const histTotal = hist.reduce((s, p) => s + (p.totalGB || 0), 0);
            usageInfo = {
              ...usageInfo,
              priorityGB: Math.round(histPriority * 100) / 100,
              standardGB: Math.round(histStandard * 100) / 100,
              totalGB: Math.round(histTotal * 100) / 100,
              billingCycleStart: hist[0].date,
              billingCycleEnd: hist[hist.length - 1].date,
              lastUpdatedAt: hist[hist.length - 1].lastUpdatedAt ?? null,
            };
          }
        } catch {
          // keep original
        }
      }

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
        billingCycleStart: p?.billingCycleStart ?? usageInfo?.billingCycleStart ?? null,
        billingCycleEnd: p?.billingCycleEnd ?? usageInfo?.billingCycleEnd ?? null,
        currentActivationDate: p?.currentActivationDate ?? null,
        subscriptionEndDate: p?.subscriptionEndDate ?? null,
        usage: usageInfo
          ? {
              priorityGB: usageInfo.priorityGB,
              standardGB: usageInfo.standardGB,
              optInPriorityGB: usageInfo.optInPriorityGB,
              nonBillableGB: usageInfo.nonBillableGB,
              totalGB: usageInfo.totalGB,
              billingCycleStart: usageInfo.billingCycleStart,
              billingCycleEnd: usageInfo.billingCycleEnd,
              lastUpdatedAt: usageInfo.lastUpdatedAt ?? null,
            }
          : null,
        error: firstError ? friendlyStarlinkErrorMessage(firstError.reason) : null,
      };
    })
  );
}

/** Daily usage for the last `days` days (max 60), summed across the account's service lines (SLASH). */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Daily usage between two UTC days (inclusive), one row per day — days with
 * no Starlink snapshot come back as zero so the table never skips a date.
 * The SLASH API allows at most 2 months per request; a calendar month or the
 * last 30 days both fit.
 */
export async function getDailyUsage(
  account: PortalAccount,
  range: { start: Date; end: Date }
): Promise<{ rows: PortalDailyUsageRow[]; error: string | null }> {
  if (account.starlinkVesselIds.length === 0) return { rows: [], error: null };
  const start = range.start;
  const end = range.end;

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
  // Every calendar day in the range, newest data never past today.
  const lastDay = Math.min(end.getTime(), Date.now());
  for (let t = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()); t <= lastDay; t += DAY_MS) {
    const date = new Date(t).toISOString().slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, { date, priorityGB: 0, standardGB: 0, nonBillableGB: 0, totalGB: 0 });
  }
  // Only fill when at least one line answered; an outright failure stays empty.
  const anyLoaded = results.some((r) => r.status === "fulfilled");
  const rows = (anyLoaded ? Array.from(byDate.values()) : [])
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
