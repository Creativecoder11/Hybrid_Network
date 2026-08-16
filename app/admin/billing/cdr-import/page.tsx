import type { Metadata } from "next";
import { connectDB } from "@/lib/db/connect";
import { CdrImportBatch } from "@/models/CdrImportBatch";
import { BillingSubNav } from "@/components/admin/BillingSubNav";
import { CdrImportPageClient } from "@/components/admin/CdrImportPageClient";
import type { CdrImportBatchRow } from "@/lib/types/retailBilling";

export const metadata: Metadata = {
  title: "CDR Import | Hybrid Networks Admin",
};

export default async function CdrImportPage() {
  await connectDB();

  const batches = await CdrImportBatch.find().sort({ createdAt: -1 }).limit(100).populate("uploadedBy").lean();

  const rows: CdrImportBatchRow[] = batches.map((b) => ({
    id: b._id.toString(),
    fileName: b.fileName,
    uploadedByName: (b.uploadedBy as unknown as { name: string } | null)?.name ?? "Unknown",
    identifierColumn: b.identifierColumn ?? "",
    wholesaleColumn: b.wholesaleColumn ?? "",
    totalRows: b.totalRows,
    processedRows: b.processedRows,
    matchedRows: b.matchedRows,
    unmatchedRows: b.unmatchedRows,
    invalidRows: b.invalidRows,
    totalWholesaleAmount: b.totalWholesaleAmount,
    totalRetailAmount: b.totalRetailAmount,
    currency: b.currency ?? "USD",
    status: b.status,
    errorLog: b.errorLog ?? [],
    createdAt: (b.createdAt as Date).toISOString(),
  }));

  return (
    <div className="space-y-6">
      <BillingSubNav />
      <CdrImportPageClient batches={rows} />
    </div>
  );
}
