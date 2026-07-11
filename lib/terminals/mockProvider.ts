import "server-only";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/models/User";
import { Subscription } from "@/models/Subscription";
import type {
  TerminalRecord,
  TerminalListFilters,
  TerminalStatus,
  TerminalFault,
  TerminalAlarm,
  TerminalAuditEntry,
  LocationHistoryPoint,
  RemoteCommandType,
} from "./types";

// ---------- deterministic PRNG, seeded per terminal so repeated reads of the
// same terminal return stable base data instead of re-randomizing every call ----------
function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function rng() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
function between(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}
function round(n: number, decimals = 1): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 3600 * 1000).toISOString();
}
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 3600 * 1000).toISOString();
}

type SourceCustomer = {
  customerId: string;
  customerName: string;
  iccid: string;
  imei: string;
  vendor: string;
  planName: string;
  planAllowanceGB: number | null;
  monthlyUsageGB: number;
  billingStatus: "CURRENT" | "OVERDUE" | "SUSPENDED_FOR_NONPAYMENT";
};

const SPARE_TERMINALS = [
  { iccid: "KITP00399001", vendor: "Starlink" },
  { iccid: "KITP00399002", vendor: "Starlink" },
];

const PRODUCT_BY_VENDOR: Record<
  string,
  { model: string; manufacturer: string; antennaType: string; modemType: string }
> = {
  Starlink: {
    model: "Starlink High Performance",
    manufacturer: "SpaceX",
    antennaType: "Flat High Performance Phased Array",
    modemType: "Starlink Integrated Modem",
  },
  Fiber: {
    model: "ONT-2000 GPON",
    manufacturer: "Huawei",
    antennaType: "N/A",
    modemType: "GPON ONT",
  },
  VSAT: {
    model: "iDirect Evolution X7",
    manufacturer: "iDirect",
    antennaType: "1.2m Parabolic VSAT",
    modemType: "iDirect Satellite Modem",
  },
  Other: {
    model: "Generic CPE-100",
    manufacturer: "Generic Networks",
    antennaType: "Omni-directional",
    modemType: "4G/LTE Modem",
  },
};

const FAULT_CATALOG: { code: string; description: string; severity: TerminalFault["severity"] }[] = [
  { code: "OBSTRUCTION-01", description: "Signal obstruction detected in field of view", severity: "MINOR" },
  { code: "PWR-LOSS-02", description: "Unexpected power loss / reboot", severity: "MAJOR" },
  { code: "THERMAL-03", description: "Operating temperature above recommended threshold", severity: "WARNING" },
  { code: "GPS-LOCK-04", description: "GPS unable to acquire location lock", severity: "MINOR" },
  { code: "MODEM-FAIL-05", description: "Modem failed to register on network", severity: "CRITICAL" },
  { code: "SIM-ERR-06", description: "SIM card not detected", severity: "CRITICAL" },
];

function buildLocationHistory(rng: () => number, baseLat: number, baseLng: number): LocationHistoryPoint[] {
  const points: LocationHistoryPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    points.push({
      id: `loc-${i}`,
      latitude: round(baseLat + between(rng, -0.05, 0.05), 5),
      longitude: round(baseLng + between(rng, -0.05, 0.05), 5),
      altitudeMeters: round(between(rng, 5, 45), 1),
      accuracyMeters: round(between(rng, 2, 12), 1),
      timestamp: hoursAgo(i * 6),
    });
  }
  return points;
}

function buildFaults(rng: () => number, hasFault: boolean): TerminalFault[] {
  if (!hasFault) return [];
  const count = rng() > 0.6 ? 2 : 1;
  const faults: TerminalFault[] = [];
  for (let i = 0; i < count; i++) {
    const spec = pick(rng, FAULT_CATALOG);
    const isOpen = i === 0;
    faults.push({
      id: `fault-${i}`,
      code: spec.code,
      description: spec.description,
      severity: spec.severity,
      status: isOpen ? "OPEN" : "CLEARED",
      startTime: hoursAgo(between(rng, 1, 72)),
      clearTime: isOpen ? null : hoursAgo(between(rng, 0, 1)),
    });
  }
  return faults;
}

function buildAlarms(rng: () => number, status: TerminalStatus, hasFault: boolean): TerminalAlarm[] {
  const alarms: TerminalAlarm[] = [];
  if (status === "SUSPENDED") {
    alarms.push({
      id: "alarm-suspension",
      type: "SUSPENSION",
      message: "Service suspended by administrator",
      triggeredAt: hoursAgo(between(rng, 1, 48)),
      acknowledged: true,
    });
  }
  if (hasFault) {
    alarms.push({
      id: "alarm-degraded",
      type: "DEGRADED_SERVICE",
      message: "Service quality degraded — investigate fault log",
      triggeredAt: hoursAgo(between(rng, 1, 24)),
      acknowledged: rng() > 0.5,
    });
  }
  if (rng() > 0.75) {
    alarms.push({
      id: "alarm-usage",
      type: "HIGH_USAGE",
      message: "Terminal approaching 90% of plan allowance",
      triggeredAt: hoursAgo(between(rng, 1, 96)),
      acknowledged: rng() > 0.3,
    });
  }
  return alarms;
}

function buildAuditHistory(rng: () => number, activationDate: string): TerminalAuditEntry[] {
  return [
    {
      id: "audit-1",
      action: "Terminal provisioned",
      actor: "Supplier API",
      timestamp: activationDate,
      details: "Terminal registered in fleet inventory and assigned to customer account.",
    },
    {
      id: "audit-2",
      action: "Firmware updated",
      actor: "System",
      timestamp: daysAgo(between(rng, 10, 40)),
      details: "Automatic firmware update applied during scheduled maintenance window.",
    },
    {
      id: "audit-3",
      action: "Plan changed",
      actor: "Admin",
      timestamp: daysAgo(between(rng, 40, 90)),
      details: "Service plan updated following customer subscription change.",
    },
  ];
}

function generateTerminal(seed: SourceCustomer | { iccid: string; vendor: string }): TerminalRecord {
  const rng = seededRandom(seed.iccid);
  const isAssigned = "customerId" in seed;
  const product = PRODUCT_BY_VENDOR[seed.vendor] ?? PRODUCT_BY_VENDOR.Other;

  const statusPool: TerminalStatus[] = isAssigned
    ? ["ACTIVE", "ACTIVE", "ACTIVE", "SUSPENDED"]
    : ["PENDING_ACTIVATION", "INACTIVE"];
  const status = pick(rng, statusPool);
  const hasFault = rng() > 0.65;
  const isOnline = status === "ACTIVE" && rng() > 0.15;

  const activationDate = isAssigned ? daysAgo(between(rng, 60, 400)) : null;
  const baseLat = 3.14 + between(rng, -2.5, 2.5); // roughly Malaysia/APAC spread
  const baseLng = 101.68 + between(rng, -3, 6);

  const monthlyUsageGB = isAssigned ? (seed as SourceCustomer).monthlyUsageGB : round(between(rng, 0, 5));
  const allowanceGB = isAssigned ? (seed as SourceCustomer).planAllowanceGB : null;
  const excessGB = allowanceGB ? Math.max(0, monthlyUsageGB - allowanceGB) : 0;

  return {
    id: seed.iccid,
    identification: {
      serialNumber: `SN-${seed.iccid.slice(-8)}`,
      imei: isAssigned ? (seed as SourceCustomer).imei || `35${seed.iccid.slice(-13)}` : `35${seed.iccid.slice(-13)}`,
      iccid: seed.iccid,
      hardwareId: `HW-${seed.iccid.slice(-6)}`,
      supplierAssetId: `SUP-${seed.iccid.slice(-6)}`,
      customerAssetReference: isAssigned ? `AST-${(seed as SourceCustomer).customerId.slice(-6)}` : "--",
    },
    product: {
      ...product,
      hardwareVersion: `rev ${pick(rng, ["A", "B", "C"])}.${Math.floor(between(rng, 1, 4))}`,
      firmwareVersion: `${Math.floor(between(rng, 2023, 2026))}.${Math.floor(between(rng, 1, 12))}.${Math.floor(
        between(rng, 0, 30)
      )}`,
      installedAccessories: rng() > 0.5 ? ["Mounting Tripod", "Ethernet Adapter"] : ["Wall Mount Bracket"],
    },
    status,
    activation: {
      activationDate,
      deactivationDate: status === "DEACTIVATED" ? daysAgo(between(rng, 1, 20)) : null,
      suspensionDate: status === "SUSPENDED" ? daysAgo(between(rng, 1, 15)) : null,
      reactivationDate: null,
      servicePlan: isAssigned ? (seed as SourceCustomer).planName : "Unassigned",
      assignedCustomerId: isAssigned ? (seed as SourceCustomer).customerId : null,
      assignedCustomerName: isAssigned ? (seed as SourceCustomer).customerName : null,
    },
    live: {
      onlineStatus: isOnline ? "ONLINE" : "OFFLINE",
      connectionState: isOnline ? pick(rng, ["CONNECTED", "CONNECTED", "CONNECTED", "IDLE"]) : "DISCONNECTED",
      signalStrengthDbm: isOnline ? Math.round(between(rng, -95, -50)) : Math.round(between(rng, -120, -100)),
      signalQualityPct: isOnline ? Math.round(between(rng, 55, 99)) : 0,
      dataSessionStatus: isOnline ? pick(rng, ["ACTIVE", "ACTIVE", "IDLE"]) : "NONE",
      lastSeenAt: isOnline ? hoursAgo(between(rng, 0, 0.2)) : hoursAgo(between(rng, 2, 96)),
    },
    location: status === "PENDING_ACTIVATION" ? null : { latitude: round(baseLat, 5), longitude: round(baseLng, 5), altitudeMeters: round(between(rng, 5, 60), 1), accuracyMeters: round(between(rng, 2, 10), 1), timestamp: hoursAgo(between(rng, 0, 1)) },
    locationHistory: status === "PENDING_ACTIVATION" ? [] : buildLocationHistory(rng, baseLat, baseLng),
    usage: {
      uploadBytes: Math.round(between(rng, 0.5, 8) * 1e9),
      downloadBytes: Math.round(monthlyUsageGB * 0.85 * 1e9),
      totalBytes: Math.round(monthlyUsageGB * 1e9),
      sessionBytes: Math.round(between(rng, 0.01, 0.6) * 1e9),
      billingPeriodBytes: Math.round(monthlyUsageGB * 1e9),
      billingPeriodMonth: new Date().toISOString().slice(0, 7),
    },
    network: {
      latencyMs: isOnline ? Math.round(between(rng, 25, 65)) : 0,
      packetLossPct: isOnline ? round(between(rng, 0, 2.5), 2) : 100,
      uptimePct: round(between(rng, 96, 99.99), 2),
      downtimeMinutesLast30d: Math.round(between(rng, 0, 180)),
      bandwidthMbps: round(between(rng, 80, 220), 0),
      throughputMbps: isOnline ? round(between(rng, 20, 180), 0) : 0,
      linkQuality: isOnline ? pick(rng, ["EXCELLENT", "GOOD", "GOOD", "FAIR"]) : "POOR",
    },
    faults: buildFaults(rng, hasFault),
    alarms: buildAlarms(rng, status, hasFault),
    health: {
      powerStatus: rng() > 0.05 ? "OK" : "FAULT",
      temperatureCelsius: Math.round(between(rng, 28, 58)),
      voltage: round(between(rng, 11.5, 12.6), 2),
      antennaAlignment: seed.vendor === "Starlink" ? pick(rng, ["ALIGNED", "ALIGNED", "MISALIGNED"]) : "UNKNOWN",
      modemStatus: rng() > 0.08 ? "OK" : "FAULT",
      simStatus: seed.vendor === "Fiber" ? "OK" : pick(rng, ["OK", "OK", "OK", "NOT_DETECTED"]),
      firmwareStatus: pick(rng, ["UP_TO_DATE", "UP_TO_DATE", "UPDATE_AVAILABLE"]),
    },
    planBilling: {
      assignedPlan: isAssigned ? (seed as SourceCustomer).planName : "Unassigned",
      planAllowanceGB: allowanceGB,
      pooledDataGroup: isAssigned && rng() > 0.5 ? "APAC-Pool-1" : null,
      monthlyUsageGB: round(monthlyUsageGB, 2),
      excessUsageGB: round(excessGB, 2),
      billingStatus: isAssigned ? (seed as SourceCustomer).billingStatus : "CURRENT",
      serviceRestrictions: status === "SUSPENDED" ? ["Data session blocked pending payment"] : [],
    },
    auditHistory: activationDate ? buildAuditHistory(rng, activationDate) : [],
    dataRefreshRateSeconds: 60,
  };
}

async function loadSourceCustomers(): Promise<SourceCustomer[]> {
  await connectDB();
  const customers = await User.find({ role: "CUSTOMER", iccid: { $nin: [null, ""] } }).lean();
  const subs = await Subscription.find({
    customer: { $in: customers.map((c) => c._id) },
    status: "ACTIVE",
  })
    .populate("plan")
    .lean();
  const subByCustomer = new Map(subs.map((s) => [s.customer.toString(), s]));

  return customers.map((c) => {
    const sub = subByCustomer.get(c._id.toString());
    const plan = sub?.plan as unknown as { name: string; dataAllowanceGB: number | null } | undefined;
    const rng = seededRandom(c.iccid! + "usage");
    const allowance = plan?.dataAllowanceGB ?? null;
    const monthlyUsageGB = allowance ? round(between(rng, allowance * 0.3, allowance * 1.1)) : round(between(rng, 20, 300));
    return {
      customerId: c._id.toString(),
      customerName: c.name,
      iccid: c.iccid!,
      imei: c.imei ?? "",
      vendor: c.vendor || "Other",
      planName: plan?.name ?? "Unassigned",
      planAllowanceGB: allowance,
      monthlyUsageGB,
      billingStatus: c.status === "SUSPENDED" ? "SUSPENDED_FOR_NONPAYMENT" : "CURRENT",
    };
  });
}

export async function mockListTerminals(filters?: TerminalListFilters): Promise<TerminalRecord[]> {
  const sourceCustomers = await loadSourceCustomers();
  let records = [
    ...sourceCustomers.map(generateTerminal),
    ...SPARE_TERMINALS.map(generateTerminal),
  ];

  if (filters?.q) {
    const q = filters.q.toLowerCase();
    records = records.filter(
      (r) =>
        r.identification.serialNumber.toLowerCase().includes(q) ||
        r.identification.imei.toLowerCase().includes(q) ||
        r.identification.iccid.toLowerCase().includes(q) ||
        (r.activation.assignedCustomerName?.toLowerCase().includes(q) ?? false)
    );
  }
  if (filters?.status && filters.status !== "ALL") {
    records = records.filter((r) => r.status === filters.status);
  }
  if (filters?.customerId) {
    records = records.filter((r) => r.activation.assignedCustomerId === filters.customerId);
  }
  if (filters?.faultStatus && filters.faultStatus !== "ANY") {
    records = records.filter((r) => r.faults.some((f) => f.status === filters.faultStatus));
  }

  return records;
}

export async function mockGetTerminal(id: string): Promise<TerminalRecord | null> {
  const all = await mockListTerminals();
  return all.find((t) => t.id === id) ?? null;
}

/** Pure function: applies a command's effect to an already-generated record (used for optimistic previews / tests). */
export function applyCommandToRecord(record: TerminalRecord, command: RemoteCommandType): TerminalRecord {
  const next = { ...record };
  switch (command) {
    case "SUSPEND":
      next.status = "SUSPENDED";
      break;
    case "REACTIVATE":
      next.status = "ACTIVE";
      break;
    case "UPDATE_FIRMWARE":
      next.health = { ...next.health, firmwareStatus: "UPDATING" };
      break;
    default:
      break;
  }
  return next;
}
