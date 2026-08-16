import { NextResponse, type NextRequest } from "next/server";
import Papa from "papaparse";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db/connect";
import { CdrChargeRecord, CDR_CHARGE_STATUSES } from "@/models/CdrChargeRecord";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  }

  const { batchId } = await params;
  const statusParam = request.nextUrl.searchParams.get("status") ?? "";
  const status = CDR_CHARGE_STATUSES.find((s) => s === statusParam);

  await connectDB();

  const records = await CdrChargeRecord.find({
    importBatch: batchId,
    ...(status ? { status } : {}),
  }).lean();

  const csv = Papa.unparse(
    records.map((r) => ({
      "Row #": r.rowNumber,
      Identifier: r.identifier,
      Description: r.description,
      "Customer Code": r.customerCode,
      "Wholesale Amount": r.wholesaleAmount,
      Currency: r.currency,
      "Retail Plan": r.retailPlanName,
      "Pricing Method": r.pricingMethodUsed ?? "",
      "Markup %": r.markupPercentUsed ?? "",
      "Fixed Price": r.fixedPriceUsed ?? "",
      "Retail Amount": r.retailAmount,
      Status: r.status,
      "Error Reason": r.errorReason,
    }))
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cdr-import-${batchId}${status ? `-${status.toLowerCase()}` : ""}.csv"`,
    },
  });
}
