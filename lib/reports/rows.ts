import type { TerminalRecord } from "@/lib/terminals/types";
import type { EnrichedAlert } from "@/lib/terminals/alerts";

// Flat row-shapers for each report type (§31). Kept separate from the
// export format logic (lib/reports/export.ts) so admin and portal routes
// can share the same row-building without duplicating field lists.

export function inventoryRows(terminals: TerminalRecord[]) {
  return terminals.map((t) => ({
    "Serial Number": t.identification.serialNumber,
    IMEI: t.identification.imei,
    ICCID: t.identification.iccid,
    "Hardware ID": t.identification.hardwareId,
    Model: t.product.model,
    Manufacturer: t.product.manufacturer,
    "Firmware Version": t.product.firmwareVersion,
    Status: t.status,
    Customer: t.activation.assignedCustomerName ?? "",
    "Service Plan": t.activation.servicePlan,
    "Activation Date": t.activation.activationDate ?? "",
  }));
}

export function statusRows(terminals: TerminalRecord[]) {
  return terminals.map((t) => ({
    "Serial Number": t.identification.serialNumber,
    Status: t.status,
    "Online Status": t.live.onlineStatus,
    "Connection State": t.live.connectionState,
    "Signal Quality (%)": t.live.signalQualityPct,
    "Last Seen": t.live.lastSeenAt,
    "Open Faults": t.faults.filter((f) => f.status === "OPEN").length,
  }));
}

export function gpsRows(terminals: TerminalRecord[]) {
  return terminals.flatMap((t) =>
    t.locationHistory.length > 0
      ? t.locationHistory.map((p) => ({
          "Serial Number": t.identification.serialNumber,
          Timestamp: p.timestamp,
          Latitude: p.latitude,
          Longitude: p.longitude,
        }))
      : t.location
        ? [{ "Serial Number": t.identification.serialNumber, Timestamp: t.location.timestamp, Latitude: t.location.latitude, Longitude: t.location.longitude }]
        : []
  );
}

export function alertRows(alerts: EnrichedAlert[]) {
  return alerts.map((a) => ({
    Device: a.terminalLabel ?? a.userTerminalId ?? "",
    Customer: a.customerName ?? "",
    Type: a.type ?? "",
    Message: a.message ?? "",
    Severity: a.severity ?? "Not reported",
    "First Seen": a.startedAt ?? "",
    "Last Seen": a.endedAt ?? (a.active ? "Ongoing" : ""),
    Status: a.active ? "Active" : "Resolved",
  }));
}

export function usageRows(terminals: TerminalRecord[]) {
  return terminals.map((t) => ({
    "Serial Number": t.identification.serialNumber,
    Customer: t.activation.assignedCustomerName ?? "",
    "Total Usage (GB)": Math.round((t.usage.totalBytes / 1e9) * 100) / 100,
    "Priority (GB)": t.usage.priorityBytes !== undefined ? Math.round((t.usage.priorityBytes / 1e9) * 100) / 100 : "",
    "Standard (GB)": t.usage.standardBytes !== undefined ? Math.round((t.usage.standardBytes / 1e9) * 100) / 100 : "",
    "Allowance (GB)": t.planBilling.planAllowanceGB ?? "Unlimited",
    "Billing Period": t.usage.billingPeriodMonth,
  }));
}
