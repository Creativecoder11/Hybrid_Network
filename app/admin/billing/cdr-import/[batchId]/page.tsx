import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db/connect";
import { CdrImportBatch } from "@/models/CdrImportBatch";
import { CdrChargeRecord } from "@/models/CdrChargeRecord";
import { CdrImportBatchDetailClient } from "@/components/admin/CdrImportBatchDetailClient";
import type { CdrImportBatchRow, CdrChargeRecordRow } from "@/lib/types/retailBilling";

export const metadata: Metadata = {
  title: "CDR Import Batch | Hybrid Networks Admin",
};

export default async function CdrImportBatchDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  await connectDB();

  const batch = await CdrImportBatch.findById(batchId).populate("uploadedBy").lean();
  if (!batch) notFound();

  const recordDocs = await CdrChargeRecord.find({ importBatch: batchId })
    .sort({ rowNumber: 1 })
    .limit(2000)
    .populate("customer")
    .lean();

  const batchRow: CdrImportBatchRow = {
    id: batch._id.toString(),
    fileName: batch.fileName,
    uploadedByName: (batch.uploadedBy as unknown as { name: string } | null)?.name ?? "Unknown",
    identifierColumn: batch.identifierColumn ?? "",
    wholesaleColumn: batch.wholesaleColumn ?? "",
    totalRows: batch.totalRows,
    processedRows: batch.processedRows,
    matchedRows: batch.matchedRows,
    unmatchedRows: batch.unmatchedRows,
    invalidRows: batch.invalidRows,
    totalWholesaleAmount: batch.totalWholesaleAmount,
    totalRetailAmount: batch.totalRetailAmount,
    currency: batch.currency ?? "USD",
    status: batch.status,
    errorLog: batch.errorLog ?? [],
    createdAt: (batch.createdAt as Date).toISOString(),
  };

  const records: CdrChargeRecordRow[] = recordDocs.map((r) => {
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

  return <CdrImportBatchDetailClient batch={batchRow} records={records} />;
}
