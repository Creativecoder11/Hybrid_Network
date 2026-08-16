import type { Metadata } from "next";
import { connectDB } from "@/lib/db/connect";
import { RetailPlan } from "@/models/RetailPlan";
import { CdrIdentifierMapping } from "@/models/CdrIdentifierMapping";
import { getCurrentUser } from "@/lib/auth/dal";
import { BillingSubNav } from "@/components/admin/BillingSubNav";
import { RetailPlansPageClient } from "@/components/admin/RetailPlansPageClient";
import type { RetailPlanRow } from "@/lib/types/retailBilling";

export const metadata: Metadata = {
  title: "Retail Plans | Hybrid Networks Admin",
};

export default async function RetailPlansPage() {
  await connectDB();

  const [plans, currentUser, mappingCounts] = await Promise.all([
    RetailPlan.find().sort({ createdAt: -1 }).lean(),
    getCurrentUser(),
    CdrIdentifierMapping.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$retailPlan", count: { $sum: 1 } } },
    ]),
  ]);

  const countByPlan = new Map(mappingCounts.map((m) => [m._id.toString(), m.count as number]));

  const rows: RetailPlanRow[] = plans.map((p) => ({
    id: p._id.toString(),
    name: p.name,
    description: p.description ?? "",
    pricingMethod: p.pricingMethod,
    markupPercent: p.markupPercent ?? 0,
    fixedPrice: p.fixedPrice ?? 0,
    currency: p.currency ?? "USD",
    isActive: p.isActive,
    mappedIdentifierCount: countByPlan.get(p._id.toString()) ?? 0,
    createdAt: (p.createdAt as Date).toISOString(),
    updatedAt: (p.updatedAt as Date).toISOString(),
  }));

  return (
    <div className="space-y-6">
      <BillingSubNav />
      <RetailPlansPageClient plans={rows} canDelete={currentUser?.role === "SUPER_ADMIN"} />
    </div>
  );
}
