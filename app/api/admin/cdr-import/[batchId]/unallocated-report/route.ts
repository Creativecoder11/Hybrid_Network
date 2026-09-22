import { NextResponse, type NextRequest } from "next/server";
import mongoose from "mongoose";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db/connect";
import { CdrChargeRecord } from "@/models/CdrChargeRecord";
import { CdrImportBatch } from "@/models/CdrImportBatch";
import { reasonLabel } from "@/lib/cdr/allocation";
import { toCsv, safeFileName } from "@/lib/reports/csv";

// Unallocated Report for a retail CDR import: every record that could not be
// allocated to a Customer Account + Product Code, with the reason.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  }

  const { batchId } = await params;
  if (!mongoose.isValidObjectId(batchId)) {
    return NextResponse.json({ success: false, error: "Upload not found." }, { status: 404 });
  }
  await connectDB();

  const batch = await CdrImportBatch.findById(batchId).lean();
  if (!batch) return NextResponse.json({ success: false, error: "Upload not found." }, { status: 404 });

  const records = await CdrChargeRecord.find({ importBatch: batchId, status: "UNMATCHED" }).sort({ rowNumber: 1 }).lean();

  const csv = toCsv(
    records.map((r) => ({
      "Upload ID": batchId,
      "File Name": batch.fileName,
      "Row Number": r.rowNumber,
      "Original Record ID": r.sourceRecordId || "",
      "Customer Code": r.customerCode || "",
      "Product Code": r.identifier || "",
      "Record Type": r.recordType || "",
      "Date / Time": r.eventAt ? new Date(r.eventAt).toISOString() : "",
      Description: r.description || "",
      "Wholesale Amount": r.wholesaleAmount,
      Currency: r.currency || "",
      "Reason Code": r.unallocatedReasonCode || "",
      Reason: reasonLabel(r.unallocatedReasonCode),
      Details: r.errorReason || "",
      Status: "UNALLOCATED",
    }))
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="unallocated-report-${safeFileName(batch.fileName)}.csv"`,
    },
  });
}
