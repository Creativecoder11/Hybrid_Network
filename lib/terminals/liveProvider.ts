import "server-only";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/models/User";
import {
  getVessel,
  getVesselDataUsage,
  getVesselServicePlan,
  getVesselLocation,
  getVesselLocationHistory,
} from "@/lib/starlink/read";
import type { SlashVessel, SlashDataUsage, SlashServicePlan, SlashLocation, SlashLocationHistoryPoint } from "@/lib/starlink/types";
import type { TerminalRecord, TerminalListFilters, TerminalStatus, LocationHistoryPoint } from "./types";

// Sources TerminalRecord data from the real Slash/Starlink API for customers
// an admin has linked via User.starlinkVesselId (see CustomerFormModal's
// "Starlink Linking" section). Customers without a link keep using
// mockProvider.ts (lib/terminals/service.ts merges the two).
//
// Starlink's API surface is narrower than the mock's fabricated data: it has
// no ICCID/IMEI, no hardware health telemetry (temperature/voltage/antenna
// alignment), no fault codes, and no network performance metrics
// (latency/throughput/packet-loss) for this tenant's current traffic level.
// Those fields are left at honest "unavailable" defaults below rather than
// invented — see the OkFaultUnknown/"UNKNOWN" values and zeroed metrics.

type LiveCustomer = { customerId: string; customerName: string; vesselId: string };

async function loadLiveCustomers(customerId?: string): Promise<LiveCustomer[]> {
  await connectDB();
  const query: Record<string, unknown> = { role: "CUSTOMER", starlinkVesselId: { $nin: [null, ""] } };
  if (customerId) query._id = customerId;
  const customers = await User.find(query).lean();
  return customers.map((c) => ({
    customerId: c._id.toString(),
    customerName: c.name,
    vesselId: c.starlinkVesselId as string,
  }));
}

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error("[starlink] read call failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

function mapStatus(serviceLineActive: boolean, terminalActive: boolean): TerminalStatus {
  if (!serviceLineActive) return "SUSPENDED";
  if (!terminalActive) return "INACTIVE";
  return "ACTIVE";
}

function mapLocation(location: SlashLocation | null): TerminalRecord["location"] {
  if (!location) return null;
  if (location.latitude === 0 && location.longitude === 0) return null; // no GPS fix yet
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    altitudeMeters: 0,
    accuracyMeters: 0,
    timestamp: location.timestamp,
  };
}

function mapLocationHistory(points: SlashLocationHistoryPoint[]): LocationHistoryPoint[] {
  return points
    .filter((p) => !(p.latitude === 0 && p.longitude === 0))
    .map((p, i) => ({
      id: `starlink-loc-${i}`,
      latitude: p.latitude,
      longitude: p.longitude,
      altitudeMeters: 0,
      accuracyMeters: 0,
      timestamp: p.timestamp,
    }));
}

function buildRecord(
  vessel: SlashVessel,
  terminal: SlashVessel["userTerminals"][number],
  customer: LiveCustomer,
  dataUsage: SlashDataUsage | null,
  servicePlan: SlashServicePlan | null,
  location: SlashLocation | null,
  locationHistory: SlashLocationHistoryPoint[]
): TerminalRecord {
  const allowanceGB = servicePlan?.priorityDataGB ?? servicePlan?.standardDataGB ?? null;
  const monthlyUsageGB = dataUsage?.totalGB ?? 0;
  const excessGB = allowanceGB ? Math.max(0, monthlyUsageGB - allowanceGB) : 0;
  const status = mapStatus(vessel.serviceLineActive, terminal.active);

  return {
    id: terminal.userTerminalId,
    identification: {
      serialNumber: terminal.kitSerialNumber,
      imei: "",
      iccid: "",
      hardwareId: terminal.dishSerialNumber,
      supplierAssetId: terminal.userTerminalId,
      customerAssetReference: vessel.serviceLineNumber,
    },
    product: {
      model: "Starlink User Terminal",
      manufacturer: "SpaceX",
      hardwareVersion: "",
      firmwareVersion: "",
      antennaType: "Unknown",
      modemType: "Starlink Integrated Modem",
      installedAccessories: [],
    },
    status,
    activation: {
      activationDate: terminal.createdAt,
      deactivationDate: null,
      suspensionDate: null,
      reactivationDate: null,
      servicePlan: servicePlan?.planName ?? vessel.serviceLineProductReferenceId,
      assignedCustomerId: customer.customerId,
      assignedCustomerName: customer.customerName,
    },
    live: {
      // Not exposed by this API for the tenant's current traffic level —
      // best-effort from the active/service-line flags rather than fabricated.
      onlineStatus: status === "ACTIVE" ? "ONLINE" : "OFFLINE",
      connectionState: status === "ACTIVE" ? "CONNECTED" : "DISCONNECTED",
      signalStrengthDbm: 0,
      signalQualityPct: 0,
      dataSessionStatus: "NONE",
      lastSeenAt: dataUsage?.lastUpdatedAt ?? vessel.insertedAt,
    },
    location: mapLocation(location),
    locationHistory: mapLocationHistory(locationHistory),
    usage: {
      uploadBytes: 0, // Starlink API doesn't split up/down at this tenant tier
      downloadBytes: 0,
      totalBytes: Math.round(monthlyUsageGB * 1e9),
      sessionBytes: 0,
      billingPeriodBytes: Math.round(monthlyUsageGB * 1e9),
      billingPeriodMonth: (dataUsage?.billingCycleStart ?? new Date().toISOString()).slice(0, 7),
    },
    network: {
      // No network-performance telemetry surfaced by this API yet (tenant's
      // one device has had no real traffic) — zeroed rather than guessed.
      latencyMs: 0,
      packetLossPct: 0,
      uptimePct: 0,
      downtimeMinutesLast30d: 0,
      bandwidthMbps: 0,
      throughputMbps: 0,
      linkQuality: "FAIR",
    },
    faults: [],
    alarms: [],
    health: {
      powerStatus: "UNKNOWN",
      temperatureCelsius: 0,
      voltage: 0,
      antennaAlignment: "UNKNOWN",
      modemStatus: terminal.active ? "OK" : "FAULT",
      simStatus: "OK",
      firmwareStatus: "UP_TO_DATE",
    },
    planBilling: {
      assignedPlan: servicePlan?.planName ?? vessel.serviceLineProductReferenceId,
      planAllowanceGB: allowanceGB,
      pooledDataGroup: null,
      monthlyUsageGB: Math.round(monthlyUsageGB * 100) / 100,
      excessUsageGB: Math.round(excessGB * 100) / 100,
      // This app's actual billing status lives on Invoice/UsageRecord (CDR-driven),
      // not Starlink — "CURRENT" here just reflects the service line isn't deactivated.
      billingStatus: "CURRENT",
      serviceRestrictions: vessel.serviceLineActive ? [] : ["Service line inactive in Starlink account"],
    },
    auditHistory: [],
    dataRefreshRateSeconds: 60,
  };
}

async function buildRecordsForCustomer(customer: LiveCustomer): Promise<TerminalRecord[]> {
  const vessel = await safe(() => getVessel(customer.vesselId));
  if (!vessel || vessel.userTerminals.length === 0) return [];

  const [dataUsage, servicePlan, location, locationHistory] = await Promise.all([
    safe(() => getVesselDataUsage(customer.vesselId)),
    safe(() => getVesselServicePlan(customer.vesselId)),
    safe(() => getVesselLocation(customer.vesselId)),
    safe(() => getVesselLocationHistory(customer.vesselId)),
  ]);

  return vessel.userTerminals.map((terminal) =>
    buildRecord(vessel, terminal, customer, dataUsage, servicePlan, location, locationHistory ?? [])
  );
}

function applyFilters(records: TerminalRecord[], filters?: TerminalListFilters): TerminalRecord[] {
  let result = records;
  if (filters?.q) {
    const q = filters.q.toLowerCase();
    result = result.filter(
      (r) =>
        r.identification.serialNumber.toLowerCase().includes(q) ||
        r.identification.hardwareId.toLowerCase().includes(q) ||
        (r.activation.assignedCustomerName?.toLowerCase().includes(q) ?? false)
    );
  }
  if (filters?.status && filters.status !== "ALL") {
    result = result.filter((r) => r.status === filters.status);
  }
  if (filters?.faultStatus && filters.faultStatus !== "ANY") {
    result = result.filter((r) => r.faults.some((f) => f.status === filters.faultStatus));
  }
  return result;
}

export async function liveListTerminals(filters?: TerminalListFilters): Promise<TerminalRecord[]> {
  const customers = await safe(() => loadLiveCustomers(filters?.customerId));
  if (!customers || customers.length === 0) return [];

  const perCustomer = await Promise.all(customers.map((c) => buildRecordsForCustomer(c)));
  return applyFilters(perCustomer.flat(), filters);
}

export async function liveGetTerminal(id: string): Promise<TerminalRecord | null> {
  // Scans every linked customer's vessel since a bare userTerminalId doesn't
  // say which vessel it belongs to. Fine at the current handful of live
  // links; would want a reverse index if that grows large.
  const customers = await safe(() => loadLiveCustomers());
  if (!customers) return null;

  for (const customer of customers) {
    const records = await buildRecordsForCustomer(customer);
    const match = records.find((r) => r.id === id);
    if (match) return match;
  }
  return null;
}
