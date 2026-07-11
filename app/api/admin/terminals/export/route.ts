import { NextResponse, type NextRequest } from "next/server";
import Papa from "papaparse";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { listTerminals } from "@/lib/terminals/service";

export async function GET(request: NextRequest) {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  }

  const format = request.nextUrl.searchParams.get("format") === "csv" ? "csv" : "json";
  const terminals = await listTerminals();

  if (format === "json") {
    return new NextResponse(JSON.stringify(terminals, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="terminals-${Date.now()}.json"`,
      },
    });
  }

  const csv = Papa.unparse(
    terminals.map((t) => ({
      "Serial Number": t.identification.serialNumber,
      IMEI: t.identification.imei,
      ICCID: t.identification.iccid,
      "Hardware ID": t.identification.hardwareId,
      Model: t.product.model,
      Manufacturer: t.product.manufacturer,
      "Firmware Version": t.product.firmwareVersion,
      Status: t.status,
      Customer: t.activation.assignedCustomerName ?? "",
      Plan: t.activation.servicePlan,
      "Online Status": t.live.onlineStatus,
      "Signal (dBm)": t.live.signalStrengthDbm,
      "Last Seen": t.live.lastSeenAt,
      Latitude: t.location?.latitude ?? "",
      Longitude: t.location?.longitude ?? "",
      "Monthly Usage (GB)": t.planBilling.monthlyUsageGB,
      "Plan Allowance (GB)": t.planBilling.planAllowanceGB ?? "Unlimited",
      "Open Faults": t.faults.filter((f) => f.status === "OPEN").length,
      "Billing Status": t.planBilling.billingStatus,
    }))
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="terminals-${Date.now()}.csv"`,
    },
  });
}
