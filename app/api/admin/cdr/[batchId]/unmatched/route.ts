import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db/connect";
import { CdrBatch } from "@/models/CdrBatch";
import { CdrRecord } from "@/models/CdrRecord";
import { reasonLabel } from "@/lib/cdr/allocation";
import { toCsv, safeFileName } from "@/lib/reports/csv";

// Unallocated Report for a usage (Rated CDR) upload.
export async function GET(_request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  }

  const { batchId } = await params;
  if (!mongoose.isValidObjectId(batchId)) {
    return NextResponse.json({ success: false, error: "Upload not found." }, { status: 404 });
  }
  await connectDB();

  const batch = await CdrBatch.findById(batchId).lean();
  if (!batch) return NextResponse.json({ success: false, error: "Upload not found." }, { status: 404 });

  const records = await CdrRecord.find({ cdrBatch: batchId, allocationStatus: "UNALLOCATED" }).sort({ startCdr: 1 }).lean();

  const csv = toCsv(
    records.map((r) => ({
      "Upload ID": batchId,
      "File Name": batch.fileName,
      "Original Record ID (Cdr ID)": r.cdrId?.startsWith("row:") ? "" : r.cdrId,
      "Customer Code": r.customerCode,
      "Product Code": r.prod,
      "Record Type / Service": r.service,
      "Date / Time": r.startCdr ? new Date(r.startCdr).toISOString() : "",
      Period: r.period,
      ICCID: r.iccid,
      "Card Name": r.cardName,
      "Volume Data (Bytes)": r.volumeDataBytes,
      "CDR Price Total": r.priceTotal,
      Currency: r.priceCurrency,
      "Reason Code": r.unallocatedReasonCode || "",
      Reason: reasonLabel(r.unallocatedReasonCode),
      Details: r.unallocatedReason || "",
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
