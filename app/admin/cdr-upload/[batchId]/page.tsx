import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db/connect";
import { CdrBatch } from "@/models/CdrBatch";
import { CdrRecord } from "@/models/CdrRecord";
import { User } from "@/models/User";
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
  await connectDB();

  const batch = await CdrBatch.findById(batchId).populate("uploadedBy").lean();
  if (!batch) notFound();

  const [unmatchedRecords, customers] = await Promise.all([
    CdrRecord.find({ cdrBatch: batchId, matched: false }).sort({ startCdr: -1 }).limit(500).lean(),
    User.find({ role: "CUSTOMER" }).select("name customerCode email").sort({ name: 1 }).lean(),
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
    skippedRows: batch.skippedRows,
    status: batch.status,
    errorLog: batch.errorLog ?? [],
    createdAt: (batch.createdAt as Date | undefined)?.toISOString() ?? "",
  };

  const unmatchedRows: UnmatchedCdrRow[] = unmatchedRecords.map((r) => ({
    id: r._id.toString(),
    cdrId: r.cdrId,
    customerCode: r.customerCode,
    iccid: r.iccid,
    cardName: r.cardName,
    service: r.service,
    vendor: r.vendor,
    period: r.period,
    volumeDataGB: toGB(r.volumeDataBytes),
    volumeTotalGB: toGB(r.volumeTotalBytes),
    priceTotal: r.priceTotal ?? 0,
    currency: r.priceCurrency ?? "MYR",
  }));

  const customerOptions = customers.map((c) => ({
    id: c._id.toString(),
    label: `${c.name}${c.customerCode ? ` (${c.customerCode})` : ""}`,
  }));

  return (
    <CdrBatchDetailClient batch={batchRow} unmatchedRows={unmatchedRows} customerOptions={customerOptions} />
  );
}
