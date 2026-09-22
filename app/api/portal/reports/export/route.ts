import { NextResponse, type NextRequest } from "next/server";
import { getPortalContextForRequest } from "@/lib/accounts/access";
import { applyLocationPolicy } from "@/lib/portal/features";
import { listTerminals } from "@/lib/terminals/service";
import { listTerminalAlerts } from "@/lib/terminals/alerts";
import { buildExportResponse, type ExportFormat } from "@/lib/reports/export";
import { inventoryRows, statusRows, gpsRows, alertRows, usageRows } from "@/lib/reports/rows";

const REPORT_TYPES = ["inventory", "status", "gps", "alerts", "usage"] as const;
type ReportType = (typeof REPORT_TYPES)[number];

// Same shape as /api/admin/reports/export, but scoped to the customer's
// selected Customer Account (validated server-side) — a customer can never
// export another account's data through this route. Location data is only
// included when the Super Admin has enabled device location.
export async function GET(request: NextRequest) {
  const ctx = await getPortalContextForRequest();
  if (!ctx) {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  }

  const typeParam = request.nextUrl.searchParams.get("type");
  const type = REPORT_TYPES.includes(typeParam as ReportType) ? (typeParam as ReportType) : "inventory";
  const formatParam = request.nextUrl.searchParams.get("format");
  const format: ExportFormat = formatParam === "xlsx" ? "xlsx" : formatParam === "json" ? "json" : "csv";

  if (type === "gps" && !ctx.features.deviceLocation) {
    return NextResponse.json({ success: false, error: "Device location has been disabled by your administrator." }, { status: 403 });
  }

  const accountIds = ctx.account ? [ctx.account.id] : [];
  let rows: Record<string, unknown>[];
  if (type === "alerts") {
    rows = alertRows(await listTerminalAlerts({ accountIds }));
  } else {
    const terminals = (await listTerminals({ accountIds })).map((t) => applyLocationPolicy(t, ctx.features));
    rows = type === "status" ? statusRows(terminals) : type === "gps" ? gpsRows(terminals) : type === "usage" ? usageRows(terminals) : inventoryRows(terminals);
  }

  const suffix = ctx.account ? `-${ctx.account.accountNumber.replace(/[^a-zA-Z0-9-_]/g, "_")}` : "";
  const { body, contentType, filename } = buildExportResponse(rows, format, `my-${type}${suffix}`);
  return new NextResponse(body as BodyInit, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
