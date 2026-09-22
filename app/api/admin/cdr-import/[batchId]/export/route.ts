import { NextResponse, type NextRequest } from "next/server";
import mongoose from "mongoose";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db/connect";
import { CdrChargeRecord, CDR_CHARGE_STATUSES } from "@/models/CdrChargeRecord";
import { reasonLabel } from "@/lib/cdr/allocation";
import { toCsv } from "@/lib/reports/csv";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  }

  const { batchId } = await params;
  if (!mongoose.isValidObjectId(batchId)) {
    return NextResponse.json({ success: false, error: "Upload not found." }, { status: 404 });
  }
  const statusParam = request.nextUrl.searchParams.get("status") ?? "";
  const status = CDR_CHARGE_STATUSES.find((s) => s === statusParam);

  await connectDB();

  const records = await CdrChargeRecord.find({
    importBatch: batchId,
    ...(status ? { status } : {}),
  })
    .populate("customerAccount", "accountNumber")
    .sort({ rowNumber: 1 })
    .lean();

  const csv = toCsv(
    records.map((r) => ({
      "Row #": r.rowNumber,
      "Record ID": r.sourceRecordId,
      "Product Code": r.identifier,
      "Product Name": r.productName ?? "",
      "Product Type": r.productType ?? "",
      "Record Type": r.recordType ?? "",
      "Date / Time": r.eventAt ? new Date(r.eventAt).toISOString() : "",
      Description: r.description,
      "Customer Code": r.customerCode,
      "Customer Account": (r.customerAccount as unknown as { accountNumber?: string } | null)?.accountNumber ?? "",
      "Wholesale Amount": r.wholesaleAmount,
      Currency: r.currency,
      "Retail Plan": r.retailPlanName,
      "Pricing Method": r.pricingMethodUsed ?? "",
      "Markup %": r.markupPercentUsed ?? "",
      "Fixed Price": r.fixedPriceUsed ?? "",
      "Retail Amount": r.retailAmount,
      Status: r.status === "MATCHED" ? "ALLOCATED" : r.status === "UNMATCHED" ? "UNALLOCATED" : r.status,
      "Unallocated Reason": r.status === "UNMATCHED" ? reasonLabel(r.unallocatedReasonCode) : "",
      Details: r.errorReason,
    }))
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cdr-import-${batchId}${status ? `-${status.toLowerCase()}` : ""}.csv"`,
    },
  });
}
