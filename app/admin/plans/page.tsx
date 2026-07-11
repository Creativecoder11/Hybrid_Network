import type { Metadata } from "next";
import { connectDB } from "@/lib/db/connect";
import { ServicePlan } from "@/models/ServicePlan";
import { Subscription } from "@/models/Subscription";
import { getCurrentUser } from "@/lib/auth/dal";
import { PlansPageClient } from "@/components/admin/PlansPageClient";
import type { PlanFull } from "@/lib/types/plan";

export const metadata: Metadata = {
  title: "Service Plans | Hybrid Networks Admin",
};

export default async function PlansPage() {
  const currentUser = await getCurrentUser();
  await connectDB();

  const plans = await ServicePlan.find().sort({ createdAt: -1 }).lean();
  const counts = await Subscription.aggregate([
    { $match: { status: "ACTIVE" } },
    { $group: { _id: "$plan", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [c._id.toString(), c.count as number]));

  const rows: PlanFull[] = plans.map((p) => ({
    id: p._id.toString(),
    name: p.name,
    provider: p.provider,
    planType: p.planType,
    monthlyPrice: p.monthlyPrice,
    currency: p.currency,
    dataAllowanceGB: p.dataAllowanceGB ?? null,
    voiceMinutes: p.voiceMinutes ?? null,
    smsCount: p.smsCount ?? null,
    overageRatePerGB: p.overageRatePerGB ?? 0,
    overageRatePerMin: p.overageRatePerMin ?? 0,
    speedMbps: p.speedMbps ?? null,
    sharedRatio: p.sharedRatio ?? "",
    isActive: p.isActive,
    subscriberCount: countMap.get(p._id.toString()) ?? 0,
  }));

  return <PlansPageClient plans={rows} canDelete={currentUser?.role === "SUPER_ADMIN"} />;
}
