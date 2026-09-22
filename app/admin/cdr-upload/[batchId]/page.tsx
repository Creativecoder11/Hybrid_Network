import type { Metadata } from "next";
import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { CdrBatch } from "@/models/CdrBatch";
import { CdrRecord } from "@/models/CdrRecord";
import { reasonLabel } from "@/lib/cdr/allocation";
import { loadAccountOptions, toReasonCounts } from "@/lib/admin/cdrOptions";
import { CdrBatchDetailClient } from "@/components/admin/CdrBatchDetailClient";
import type { CdrBatchRow, UnmatchedCdrRow } from "@/lib/types/cdr";

export const metadata: Metadata = {
  title: "CDR Batch | Hybrid Networks Admin",
};

const GB = 1_000_000_000;
const toGB = (bytes: number | null | undefined) => Math.round(((bytes ?? 0) / GB) * 100) / 100;

export default async function CdrBatchDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  if (!mongoose.isValidObjectId(batchId)) notFound();
  await connectDB();

  const batch = await CdrBatch.findById(batchId).populate("uploadedBy").lean();
  if (!batch) notFound();

  const [unallocatedRecords, reasonRows, accountOptions] = await Promise.all([
    CdrRecord.find({ cdrBatch: batchId, allocationStatus: "UNALLOCATED" }).sort({ startCdr: -1 }).limit(500).lean(),
    CdrRecord.aggregate<{ _id: string | null; count: number }>([
      { $match: { cdrBatch: new mongoose.Types.ObjectId(batchId), allocationStatus: "UNALLOCATED" } },
      { $group: { _id: "$unallocatedReasonCode", count: { $sum: 1 } } },
    ]),
    batch.unmatchedRows > 0 ? loadAccountOptions() : Promise.resolve([]),
  ]);

  const batchRow: CdrBatchRow = {
    id: batch._id.toString(),
    fileName: batch.fileName,
    uploadedByName: (batch.uploadedBy as unknown as { name: string } | null)?.name ?? "Unknown",
    provider: batch.provider ?? "",
    periodMonth: batch.periodMonth ?? "",
    uploadMode: batch.uploadMode,
    totalRows: batch.totalRows,
    matchedRows: batch.matchedRows,
    unmatchedRows: batch.unmatchedRows,
    duplicateRows: batch.duplicateRows ?? 0,
    skippedRows: batch.skippedRows,
    distinctCustomerCodes: batch.distinctCustomerCodes ?? 0,
    alertAcknowledged: Boolean(batch.alertAcknowledgedAt),
    status: batch.status,
    errorLog: batch.errorLog ?? [],
    createdAt: (batch.createdAt as Date | undefined)?.toISOString() ?? "",
  };

  const unmatchedRows: UnmatchedCdrRow[] = unallocatedRecords.map((r) => ({
    id: r._id.toString(),
    cdrId: r.cdrId?.startsWith("row:") ? "" : r.cdrId,
    customerCode: r.customerCode,
    productCode: r.prod ?? "",
    reasonLabel: reasonLabel(r.unallocatedReasonCode),
    reason: r.unallocatedReason ?? "",
    startCdr: r.startCdr ? (r.startCdr as Date).toISOString() : null,
    iccid: r.iccid,
    cardName: r.cardName,
    service: r.service,
    vendor: r.vendor,
    period: r.period,
    volumeDataGB: toGB(r.volumeDataBytes),
    volumeTotalGB: toGB(r.volumeTotalBytes),
    priceTotal: r.priceTotal ?? 0,
    currency: r.priceCurrency ?? "USD",
  }));

  return (
    <CdrBatchDetailClient
      batch={batchRow}
      unmatchedRows={unmatchedRows}
      reasons={toReasonCounts(reasonRows)}
      accountOptions={accountOptions}
    />
  );
}
