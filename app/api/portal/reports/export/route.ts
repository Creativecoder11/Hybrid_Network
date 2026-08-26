import { NextResponse, type NextRequest } from "next/server";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { listTerminals } from "@/lib/terminals/service";
import { listTerminalAlerts } from "@/lib/terminals/alerts";
import { buildExportResponse, type ExportFormat } from "@/lib/reports/export";
import { inventoryRows, statusRows, gpsRows, alertRows, usageRows } from "@/lib/reports/rows";

const REPORT_TYPES = ["inventory", "status", "gps", "alerts", "usage"] as const;
type ReportType = (typeof REPORT_TYPES)[number];

// Same shape as /api/admin/reports/export, but every query is scoped to the
// requesting customer's own terminals — a customer can never export another
// account's data through this route.
export async function GET(request: NextRequest) {
  const user = await getAuthorizedUser(["CUSTOMER"]);
  if (!user) {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  }

  const typeParam = request.nextUrl.searchParams.get("type");
  const type = REPORT_TYPES.includes(typeParam as ReportType) ? (typeParam as ReportType) : "inventory";
  const formatParam = request.nextUrl.searchParams.get("format");
  const format: ExportFormat = formatParam === "xlsx" ? "xlsx" : formatParam === "json" ? "json" : "csv";

  let rows: Record<string, unknown>[];
  if (type === "alerts") {
    rows = alertRows(await listTerminalAlerts({ customerId: user.id }));
  } else {
    const terminals = await listTerminals({ customerId: user.id });
    rows = type === "status" ? statusRows(terminals) : type === "gps" ? gpsRows(terminals) : type === "usage" ? usageRows(terminals) : inventoryRows(terminals);
  }

  const { body, contentType, filename } = buildExportResponse(rows, format, `my-${type}`);
  return new NextResponse(body as BodyInit, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
