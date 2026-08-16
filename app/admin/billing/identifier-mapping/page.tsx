import type { Metadata } from "next";
import { connectDB } from "@/lib/db/connect";
import { CdrIdentifierMapping } from "@/models/CdrIdentifierMapping";
import { RetailPlan, type RetailPlanDoc } from "@/models/RetailPlan";
import { CdrChargeRecord } from "@/models/CdrChargeRecord";
import { getCurrentUser } from "@/lib/auth/dal";
import { formatCurrency } from "@/lib/utils/format";
import { BillingSubNav } from "@/components/admin/BillingSubNav";
import { IdentifierMappingPageClient, type UnmappedIdentifierRow } from "@/components/admin/IdentifierMappingPageClient";
import type { CdrIdentifierMappingRow } from "@/lib/types/retailBilling";

export const metadata: Metadata = {
  title: "Identifier Mapping | Hybrid Networks Admin",
};

function pricingValueLabel(plan: Pick<RetailPlanDoc, "pricingMethod" | "markupPercent" | "fixedPrice" | "currency">): string {
  return plan.pricingMethod === "PERCENTAGE_MARKUP"
    ? `${plan.markupPercent}% markup`
    : `${formatCurrency(plan.fixedPrice, plan.currency)} fixed`;
}

export default async function IdentifierMappingPage() {
  await connectDB();

  const [mappingDocs, retailPlans, currentUser, unmatchedAgg] = await Promise.all([
    CdrIdentifierMapping.find().populate<{ retailPlan: RetailPlanDoc & { _id: unknown } }>("retailPlan").sort({ updatedAt: -1 }).lean(),
    RetailPlan.find().sort({ name: 1 }).lean(),
    getCurrentUser(),
    CdrChargeRecord.aggregate([
      { $match: { status: "UNMATCHED" } },
      {
        $group: {
          _id: "$identifier",
          recordCount: { $sum: 1 },
          totalWholesaleAmount: { $sum: "$wholesaleAmount" },
          currency: { $first: "$currency" },
        },
      },
      { $sort: { recordCount: -1 } },
      { $limit: 100 },
    ]),
  ]);

  const mappings: CdrIdentifierMappingRow[] = mappingDocs
    .filter((m) => m.retailPlan)
    .map((m) => {
      const plan = m.retailPlan;
      return {
        id: m._id.toString(),
        identifier: m.identifier,
        retailPlanId: (plan._id as { toString(): string }).toString(),
        retailPlanName: plan.name,
        retailPlanActive: plan.isActive,
        pricingMethod: plan.pricingMethod,
        pricingValueLabel: pricingValueLabel(plan),
        isActive: m.isActive,
        createdAt: (m.createdAt as Date).toISOString(),
        updatedAt: (m.updatedAt as Date).toISOString(),
      };
    });

  const activeIdentifiers = new Set(mappings.filter((m) => m.isActive).map((m) => m.identifier.trim().toLowerCase()));
  const unmapped: UnmappedIdentifierRow[] = unmatchedAgg
    .filter((u) => !activeIdentifiers.has(String(u._id).trim().toLowerCase()))
    .map((u) => ({
      identifier: u._id,
      recordCount: u.recordCount,
      totalWholesaleAmount: Math.round((u.totalWholesaleAmount ?? 0) * 100) / 100,
      currency: u.currency ?? "USD",
    }));

  const retailPlanOptions = retailPlans.map((p) => ({
    id: p._id.toString(),
    name: p.name,
    isActive: p.isActive,
  }));

  return (
    <div className="space-y-6">
      <BillingSubNav />
      <IdentifierMappingPageClient
        mappings={mappings}
        unmapped={unmapped}
        retailPlans={retailPlanOptions}
        canDelete={currentUser?.role === "SUPER_ADMIN"}
      />
    </div>
  );
}
