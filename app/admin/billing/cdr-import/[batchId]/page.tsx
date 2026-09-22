import type { Metadata } from "next";
import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { CdrImportBatch } from "@/models/CdrImportBatch";
import { CdrChargeRecord } from "@/models/CdrChargeRecord";
import { loadAccountOptions, toReasonCounts, toChargeRow } from "@/lib/admin/cdrOptions";
import { CdrImportBatchDetailClient } from "@/components/admin/CdrImportBatchDetailClient";
import type { CdrImportBatchRow } from "@/lib/types/retailBilling";

export const metadata: Metadata = {
  title: "CDR Import Batch | Hybrid Networks Admin",
};

export default async function CdrImportBatchDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  if (!mongoose.isValidObjectId(batchId)) notFound();
  await connectDB();

  const batch = await CdrImportBatch.findById(batchId).populate("uploadedBy").lean();
  if (!batch) notFound();

  const [recordDocs, reasonRows, accountOptions] = await Promise.all([
    CdrChargeRecord.find({ importBatch: batchId })
      .sort({ status: -1, rowNumber: 1 })
      .limit(2000)
      .populate("customer", "name company")
      .populate("customerAccount", "accountNumber")
      .lean(),
    CdrChargeRecord.aggregate<{ _id: string | null; count: number }>([
      { $match: { importBatch: new mongoose.Types.ObjectId(batchId), status: "UNMATCHED" } },
      { $group: { _id: "$unallocatedReasonCode", count: { $sum: 1 } } },
    ]),
    batch.unmatchedRows > 0 ? loadAccountOptions() : Promise.resolve([]),
  ]);

  const batchRow: CdrImportBatchRow = {
    id: batch._id.toString(),
    fileName: batch.fileName,
    uploadedByName: (batch.uploadedBy as unknown as { name: string } | null)?.name ?? "Unknown",
    identifierColumn: batch.identifierColumn ?? "",
    wholesaleColumn: batch.wholesaleColumn ?? "",
    customerCodeColumn: batch.customerCodeColumn ?? "",
    recordTypeColumn: batch.recordTypeColumn ?? "",
    totalRows: batch.totalRows,
    processedRows: batch.processedRows,
    matchedRows: batch.matchedRows,
    unmatchedRows: batch.unmatchedRows,
    invalidRows: batch.invalidRows,
    duplicateRows: batch.duplicateRows ?? 0,
    distinctCustomerCodes: batch.distinctCustomerCodes ?? 0,
    alertAcknowledged: Boolean(batch.alertAcknowledgedAt),
    processingMs: batch.processingMs ?? 0,
    totalWholesaleAmount: batch.totalWholesaleAmount,
    totalRetailAmount: batch.totalRetailAmount,
    currency: batch.currency ?? "USD",
    status: batch.status,
    errorLog: batch.errorLog ?? [],
    createdAt: (batch.createdAt as Date).toISOString(),
  };

  return (
    <CdrImportBatchDetailClient
      batch={batchRow}
      records={recordDocs.map((r) => toChargeRow(r as unknown as Parameters<typeof toChargeRow>[0]))}
      reasons={toReasonCounts(reasonRows)}
      accountOptions={accountOptions}
    />
  );
}
