import "server-only";
import { connectDB } from "@/lib/db/connect";
import { Subscription } from "@/models/Subscription";
import { UsageRecord } from "@/models/UsageRecord";
import type { PortalPlanInfo, PortalUsageInfo } from "@/lib/types/portal";

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

export async function getActivePlanInfo(customerId: string): Promise<PortalPlanInfo | null> {
  await connectDB();
  const subscription = await Subscription.findOne({ customer: customerId, status: "ACTIVE" })
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

export async function getUsageForPeriod(
  customerId: string,
  periodMonth: string
): Promise<PortalUsageInfo | null> {
  await connectDB();
  const usage = await UsageRecord.findOne({ customer: customerId, periodMonth });
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
