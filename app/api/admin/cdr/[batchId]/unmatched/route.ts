import { NextResponse } from "next/server";
import Papa from "papaparse";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db/connect";
import { CdrRecord } from "@/models/CdrRecord";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  }

  const { batchId } = await params;
  await connectDB();

  const records = await CdrRecord.find({ cdrBatch: batchId, matched: false }).lean();

  const csv = Papa.unparse(
    records.map((r) => ({
      "Cdr ID": r.cdrId,
      "Customer Code": r.customerCode,
      ICCID: r.iccid,
      "Card Name": r.cardName,
      Service: r.service,
      Vendor: r.vendor,
      Period: r.period,
      "Start CDR": r.startCdr ? new Date(r.startCdr).toISOString() : "",
      "Volume Data (Bytes)": r.volumeDataBytes,
      "Volume Total (Bytes)": r.volumeTotalBytes,
      "CDR Price Total": r.priceTotal,
    }))
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="unmatched-cdr-${batchId}.csv"`,
    },
  });
}
