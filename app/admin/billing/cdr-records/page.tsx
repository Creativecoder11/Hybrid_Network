import type { Metadata } from "next";
import { connectDB } from "@/lib/db/connect";
import { CdrChargeRecord } from "@/models/CdrChargeRecord";
import { CdrImportBatch } from "@/models/CdrImportBatch";
import { User } from "@/models/User";
import { BillingSubNav } from "@/components/admin/BillingSubNav";
import { CdrRecordsPageClient } from "@/components/admin/CdrRecordsPageClient";
import type { CdrChargeRecordRow } from "@/lib/types/retailBilling";

export const metadata: Metadata = {
  title: "CDR Records | Hybrid Networks Admin",
};

export default async function CdrRecordsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "ALL";
  const q = typeof sp.q === "string" ? sp.q : "";
  const batchId = typeof sp.batchId === "string" ? sp.batchId : "";

  await connectDB();

  // Matches both identifier and (populated) customer name, so the DB-level
  // filter only narrows by status/batch — the text search is applied below,
  // same trade-off as the Billing page's invoice search.
  const filter: Record<string, unknown> = {};
  if (status !== "ALL") filter.status = status;
  if (batchId) filter.importBatch = batchId;

  const [recordDocs, batches, customers] = await Promise.all([
    CdrChargeRecord.find(filter).sort({ createdAt: -1 }).limit(300).populate("customer").lean(),
    CdrImportBatch.find().sort({ createdAt: -1 }).limit(100).select("fileName").lean(),
    User.find({ role: "CUSTOMER" }).select("name customerCode").sort({ name: 1 }).lean(),
  ]);

  let records: CdrChargeRecordRow[] = recordDocs.map((r) => {
    const customer = r.customer as unknown as { _id: unknown; name: string; customerCode?: string } | null;
    return {
      id: r._id.toString(),
      rowNumber: r.rowNumber,
      identifier: r.identifier,
      description: r.description,
      customerId: customer ? (customer._id as { toString(): string }).toString() : "",
      customerName: customer?.name ?? "",
      customerCode: r.customerCode ?? customer?.customerCode ?? "",
      wholesaleAmount: r.wholesaleAmount,
      currency: r.currency ?? "USD",
      retailPlanName: r.retailPlanName ?? "",
      pricingMethodUsed: r.pricingMethodUsed ?? null,
      markupPercentUsed: r.markupPercentUsed ?? null,
      fixedPriceUsed: r.fixedPriceUsed ?? null,
      retailAmount: r.retailAmount,
      status: r.status,
      errorReason: r.errorReason ?? "",
      invoiceId: r.invoice ? (r.invoice as { toString(): string }).toString() : null,
      createdAt: (r.createdAt as Date).toISOString(),
    };
  });

  if (q.trim()) {
    const needle = q.trim().toLowerCase();
    records = records.filter(
      (r) => r.identifier.toLowerCase().includes(needle) || r.customerName.toLowerCase().includes(needle)
    );
  }

  return (
    <div className="space-y-6">
      <BillingSubNav />
      <CdrRecordsPageClient
        records={records}
        status={status}
        q={q}
        batchId={batchId}
        batchOptions={batches.map((b) => ({ id: b._id.toString(), fileName: b.fileName }))}
        customerOptions={customers.map((c) => ({
          id: c._id.toString(),
          label: `${c.name}${c.customerCode ? ` (${c.customerCode})` : ""}`,
        }))}
      />
    </div>
  );
}
