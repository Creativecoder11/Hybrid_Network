import type { Metadata } from "next";
import { connectDB } from "@/lib/db/connect";
import { CdrIdentifierMapping } from "@/models/CdrIdentifierMapping";
import { RetailPlan, type RetailPlanDoc } from "@/models/RetailPlan";
import { CdrChargeRecord } from "@/models/CdrChargeRecord";
import { CdrRecord } from "@/models/CdrRecord";
import { getCurrentUser } from "@/lib/auth/dal";
import { formatCurrency } from "@/lib/utils/format";
import { CdrSubNav } from "@/components/admin/CdrSubNav";
import { IdentifierMappingPageClient, type UnmappedIdentifierRow } from "@/components/admin/IdentifierMappingPageClient";
import type { CdrIdentifierMappingRow } from "@/lib/types/retailBilling";

export const metadata: Metadata = {
  title: "Product Codes | Hybrid Networks Admin",
};

function pricingValueLabel(plan: Pick<RetailPlanDoc, "pricingMethod" | "markupPercent" | "fixedPrice" | "currency">): string {
  return plan.pricingMethod === "PERCENTAGE_MARKUP"
    ? `${plan.markupPercent}% markup`
    : `${formatCurrency(plan.fixedPrice, plan.currency)} fixed`;
}

export default async function ProductCodesPage() {
  await connectDB();

  const [mappingDocs, retailPlans, currentUser, unknownCharges, unknownUsage] = await Promise.all([
    CdrIdentifierMapping.find().populate<{ retailPlan: (RetailPlanDoc & { _id: unknown }) | null }>("retailPlan").sort({ isActive: -1, identifier: 1 }).lean(),
    RetailPlan.find().sort({ name: 1 }).lean(),
    getCurrentUser(),
    // Product codes seen on unallocated records in either CDR pipeline.
    CdrChargeRecord.aggregate([
      { $match: { status: "UNMATCHED", unallocatedReasonCode: { $in: ["PRODUCT_CODE_NOT_FOUND", "PRODUCT_INACTIVE", "PRODUCT_HAS_NO_PRICING", null] } } },
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
    CdrRecord.aggregate([
      { $match: { allocationStatus: "UNALLOCATED", unallocatedReasonCode: { $in: ["PRODUCT_CODE_NOT_FOUND", "PRODUCT_INACTIVE"] } } },
      { $group: { _id: "$prod", recordCount: { $sum: 1 } } },
      { $sort: { recordCount: -1 } },
      { $limit: 100 },
    ]),
  ]);

  const mappings: CdrIdentifierMappingRow[] = mappingDocs.map((m) => {
    const plan = m.retailPlan;
    return {
      id: m._id.toString(),
      identifier: m.identifier,
      name: m.name || "",
      productType: m.productType ?? "OTHER",
      category: m.category ?? "",
      description: m.description ?? "",
      retailPlanId: plan ? (plan._id as { toString(): string }).toString() : "",
      retailPlanName: plan?.name ?? "",
      retailPlanActive: plan?.isActive ?? false,
      pricingMethod: plan?.pricingMethod ?? null,
      pricingValueLabel: plan ? pricingValueLabel(plan) : "No pricing rule",
      isActive: m.isActive,
      createdAt: (m.createdAt as Date).toISOString(),
      updatedAt: (m.updatedAt as Date).toISOString(),
    };
  });

  const activeCodes = new Set(mappings.filter((m) => m.isActive).map((m) => m.identifier.trim().toLowerCase()));
  const unmappedByCode = new Map<string, UnmappedIdentifierRow>();
  for (const u of unknownCharges) {
    const code = String(u._id ?? "").trim();
    if (!code) continue;
    unmappedByCode.set(code.toLowerCase(), {
      identifier: code,
      recordCount: u.recordCount,
      totalWholesaleAmount: Math.round((u.totalWholesaleAmount ?? 0) * 100) / 100,
      currency: u.currency ?? "USD",
      hasPricingOnly: activeCodes.has(code.toLowerCase()),
    });
  }
  for (const u of unknownUsage) {
    const code = String(u._id ?? "").trim();
    if (!code || activeCodes.has(code.toLowerCase())) continue;
    const existing = unmappedByCode.get(code.toLowerCase());
    if (existing) existing.recordCount += u.recordCount;
    else unmappedByCode.set(code.toLowerCase(), { identifier: code, recordCount: u.recordCount, totalWholesaleAmount: 0, currency: "", hasPricingOnly: false });
  }

  return (
    <div className="space-y-6">
      <CdrSubNav />
      <IdentifierMappingPageClient
        mappings={mappings}
        unmapped={Array.from(unmappedByCode.values()).sort((a, b) => b.recordCount - a.recordCount)}
        retailPlans={retailPlans.map((p) => ({ id: p._id.toString(), name: p.name, isActive: p.isActive }))}
        canDelete={currentUser?.role === "SUPER_ADMIN"}
      />
    </div>
  );
}
