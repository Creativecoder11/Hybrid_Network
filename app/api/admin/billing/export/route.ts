import { NextResponse, type NextRequest } from "next/server";
import Papa from "papaparse";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import { formatDate, formatPeriodMonth } from "@/lib/utils/format";

export async function GET(request: NextRequest) {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  }

  await connectDB();

  const status = request.nextUrl.searchParams.get("status") ?? "ALL";
  const customerId = request.nextUrl.searchParams.get("customerId") ?? "";
  const period = request.nextUrl.searchParams.get("period") ?? "";

  const filter: Record<string, unknown> = {};
  if (status !== "ALL") filter.status = status;
  if (customerId) filter.customer = customerId;
  if (period) filter.periodMonth = period;

  const invoices = await Invoice.find(filter).sort({ issueDate: -1 }).limit(500).populate("customer").lean();

  const csv = Papa.unparse(
    invoices.map((inv) => {
      const customer = inv.customer as unknown as {
        name?: string;
        customerCode?: string;
        cardName?: string;
        vendor?: string;
      } | null;
      return {
        Invoice: inv.invoiceNumber,
        Customer: customer?.name ?? "",
        "Customer Code": customer?.customerCode ?? "",
        "Card Name": customer?.cardName ?? "",
        "Product & Service": customer?.vendor ?? "",
        Period: formatPeriodMonth(inv.periodMonth),
        "Due Date": formatDate(inv.dueDate),
        Amount: inv.total,
        Currency: inv.currency ?? "USD",
        Status: inv.status,
      };
    })
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bills-${Date.now()}.csv"`,
    },
  });
}
