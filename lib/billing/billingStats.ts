import "server-only";
import { Invoice } from "@/models/Invoice";
import type { BillingStats } from "@/lib/types/billing";

const APP_TIMEZONE = "Asia/Dhaka";

function currentAndPrevPeriod(): { current: string; prev: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const current = `${year}${String(month + 1).padStart(2, "0")}`;
  const prevDate = new Date(year, month - 1, 1);
  const prev = `${prevDate.getFullYear()}${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
  return { current, prev };
}

export function currentBillingCycle(): { periodMonth: string; cycleLabel: string; cycleDaysLeft: number } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const monthName = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: APP_TIMEZONE }).format(now);
  const cycleDaysLeft = Math.max(
    0,
    Math.ceil((new Date(year, month + 1, 0).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );
  return {
    periodMonth: `${year}${String(month + 1).padStart(2, "0")}`,
    cycleLabel: `1–${lastDay} ${monthName} ${year}`,
    cycleDaysLeft,
  };
}

export async function getBillingStats(): Promise<BillingStats> {
  const { current, prev } = currentAndPrevPeriod();
  const { cycleLabel, cycleDaysLeft } = currentBillingCycle();

  const [billedAgg, prevBilledAgg, collectedAgg, pendingAgg, overdueAgg] = await Promise.all([
    Invoice.aggregate([
      { $match: { periodMonth: current, status: { $ne: "CANCELLED" } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    Invoice.aggregate([
      { $match: { periodMonth: prev, status: { $ne: "CANCELLED" } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    Invoice.aggregate([
      { $match: { periodMonth: current, status: "PAID" } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    Invoice.aggregate([
      { $match: { periodMonth: current, status: "DRAFT" } },
      { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } },
    ]),
    Invoice.aggregate([
      { $match: { status: "OVERDUE" } },
      { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } },
    ]),
  ]);

  const billedThisCycle = billedAgg[0]?.total ?? 0;
  const billedPrevCycle = prevBilledAgg[0]?.total ?? 0;
  const collected = collectedAgg[0]?.total ?? 0;

  return {
    billedThisCycle,
    billedTrendPct:
      billedPrevCycle > 0
        ? ((billedThisCycle - billedPrevCycle) / billedPrevCycle) * 100
        : billedThisCycle > 0
          ? 100
          : 0,
    collected,
    collectionRate: billedThisCycle > 0 ? (collected / billedThisCycle) * 100 : 0,
    pendingReviewAmount: pendingAgg[0]?.total ?? 0,
    pendingReviewCount: pendingAgg[0]?.count ?? 0,
    overdueAmount: overdueAgg[0]?.total ?? 0,
    overdueCount: overdueAgg[0]?.count ?? 0,
    cycleLabel,
    cycleDaysLeft,
  };
}

export function buildPlanSpecLabel(plan: {
  provider: string;
  speedMbps?: number | null;
  sharedRatio?: string | null;
  dataAllowanceGB?: number | null;
}): string {
  if (plan.speedMbps) {
    return plan.sharedRatio ? `Dedicated: ${plan.sharedRatio} ${plan.speedMbps} Mbps` : `${plan.speedMbps} Mbps`;
  }
  if (plan.dataAllowanceGB) {
    return `Data Allowance: ${plan.dataAllowanceGB} GB`;
  }
  return plan.provider;
}
