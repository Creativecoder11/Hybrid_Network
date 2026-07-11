import type { Metadata } from "next";
import { connectDB } from "@/lib/db/connect";
import { CdrBatch } from "@/models/CdrBatch";
import { CdrUploadPageClient } from "@/components/admin/CdrUploadPageClient";
import type { CdrBatchRow } from "@/lib/types/cdr";

export const metadata: Metadata = {
  title: "CDR Upload | Hybrid Networks Admin",
};

export default async function CdrUploadPage() {
  await connectDB();
  const batches = await CdrBatch.find().sort({ createdAt: -1 }).limit(50).populate("uploadedBy").lean();

  const rows: CdrBatchRow[] = batches.map((b) => ({
    id: b._id.toString(),
    fileName: b.fileName,
    uploadedByName: (b.uploadedBy as unknown as { name: string } | null)?.name ?? "Unknown",
    provider: b.provider ?? "",
    periodMonth: b.periodMonth ?? "",
    uploadMode: b.uploadMode,
    totalRows: b.totalRows,
    matchedRows: b.matchedRows,
    unmatchedRows: b.unmatchedRows,
    skippedRows: b.skippedRows,
    status: b.status,
    errorLog: b.errorLog ?? [],
    createdAt: (b.createdAt as Date | undefined)?.toISOString() ?? "",
  }));

  return <CdrUploadPageClient batches={rows} />;
}
