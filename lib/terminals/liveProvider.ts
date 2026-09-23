import "server-only";
import { connectDB } from "@/lib/db/connect";
import { CustomerAccount } from "@/models/CustomerAccount";
import { User } from "@/models/User";
import { getVessel, listVessels } from "@/lib/starlink/vessels";
import { getVesselDataUsage, listCurrentDataUsage } from "@/lib/starlink/usage";
import { getVesselServicePlan } from "@/lib/starlink/service-plans";
import { getVesselLocation, getVesselLocationHistory, listCurrentLocations } from "@/lib/starlink/locations";
import { listLatestTelemetry } from "@/lib/starlink/telemetry";
import { describeStarlinkError } from "@/lib/starlink/client";
import { deriveConnectivity } from "./status";
import type {
  SlashVessel,
  SlashDataUsage,
  SlashServicePlan,
  SlashLocation,
  SlashLocationHistoryPoint,
  SlashVesselLatestTelemetry,
} from "@/lib/starlink/types";
import type { TerminalRecord, TerminalListFilters, TerminalStatus, LocationHistoryPoint } from "./types";

// SLASH API -> normalized TerminalRecord adapter.
//
// Ownership: a SLASH vessel (one service line + its user terminals) belongs
// to the Customer Account whose starlinkVesselIds contains it. Customer
// queries are always account-scoped; admin queries without a customer /
// account filter also include tenant vessels not yet linked to any account,
// so they can be spotted and assigned.
//
// Field sources (official spec, see docs/slash-api-integration-plan.md §10):
//   online / connection   <- /telemetry/vessels/latest  lastSeenAt (lib/terminals/status.ts)
//   signal quality        <- /telemetry/vessels/latest  signalQualityPercent
//   throughput down/up    <- /telemetry/vessels/latest  downlinkThroughputMbps / uplinkThroughputMbps
//   latency / drop rate   <- /telemetry/vessels/latest  pingLatencyMsAvg / pingDropRateAvg
//   obstruction / uptime  <- /telemetry/vessels/latest  obstructionPercentTime / uptimeSeconds
//   firmware              <- /telemetry/vessels/latest  runningSoftwareVersion
//   location              <- /vessels/{id}/location/current (fallback: telemetry latitude/longitude)
//   usage (current cycle) <- /vessels/{id}/data-usage/current
//   plan                  <- /vessels/{id}/service-plan (detail view)
// Anything SLASH does not expose (dBm, temperature, voltage, link quality...)
// is null / UNKNOWN — never invented.

type LiveLink = {
  accountId: string | null;
  accountNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  vesselId: string;
};

type Sources = {
  vessels: Map<string, SlashVessel>;
  telemetry: Map<string, SlashVesselLatestTelemetry>;
  /** Vessels whose telemetry request failed ("*" = the fleet-wide call failed). */
  telemetryFailed: Set<string>;
  usage: Map<string, SlashDataUsage>;
  locations: Map<string, SlashLocation>;
  plans: Map<string, SlashServicePlan>;
  history: Map<string, SlashLocationHistoryPoint[]>;
};

// Above this many vessels, fleet-wide bulk endpoints are cheaper than
// per-vessel calls.
const BULK_THRESHOLD = 3;

async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[slash] ${label} failed: ${describeStarlinkError(err)}`);
    return null;
  }
}

async function loadLinks(filters?: TerminalListFilters): Promise<LiveLink[]> {
  await connectDB();
  const query: Record<string, unknown> = { "starlinkVesselIds.0": { $exists: true } };
  if (filters?.accountIds) query._id = { $in: filters.accountIds };
  if (filters?.customerId) query.customer = filters.customerId;
  const accounts = await CustomerAccount.find(query).select("accountNumber customer starlinkVesselIds").lean();

  const customerIds = Array.from(new Set(accounts.map((a) => a.customer.toString())));
  const customers = await User.find({ _id: { $in: customerIds } }).select("name company").lean();
  const nameById = new Map(customers.map((c) => [c._id.toString(), c.company || c.name]));

  const links: LiveLink[] = [];
  const seen = new Set<string>();
  for (const a of accounts) {
    for (const vesselId of a.starlinkVesselIds ?? []) {
      if (!vesselId || seen.has(vesselId)) continue; // one owner per vessel
      seen.add(vesselId);
      links.push({
        accountId: a._id.toString(),
        accountNumber: a.accountNumber,
        customerId: a.customer.toString(),
        customerName: nameById.get(a.customer.toString()) ?? null,
        vesselId,
      });
    }
  }
  return links;
}

function toMap<T>(entries: (readonly [string, T] | null)[]): Map<string, T> {
  return new Map(entries.filter((e): e is readonly [string, T] => e !== null));
}

async function loadSources(vesselIds: string[], opts: { detail: boolean; allVessels?: SlashVessel[] }): Promise<Sources> {
  const bulk = vesselIds.length > BULK_THRESHOLD;

  const vesselsPromise = opts.allVessels
    ? Promise.resolve(new Map(opts.allVessels.map((v) => [v.vesselId, v])))
    : bulk
      ? safe("GET /vessels", listVessels).then((all) => new Map((all ?? []).map((v) => [v.vesselId, v])))
      : Promise.all(vesselIds.map((id) => safe(`GET /vessels/${id}`, () => getVessel(id)).then((v) => (v ? ([id, v] as const) : null)))).then(toMap);

  const telemetryPromise: Promise<{ rows: SlashVesselLatestTelemetry[]; failed: Set<string> }> = bulk
    ? safe("GET /telemetry/vessels/latest", () => listLatestTelemetry()).then((rows) => ({
        rows: rows ?? [],
        failed: rows ? new Set<string>() : new Set(["*"]),
      }))
    : Promise.all(
        vesselIds.map((id) =>
          safe(`GET /telemetry/vessels/latest?vesselId=${id}`, () => listLatestTelemetry({ vesselId: id })).then(
            (rows) => ({ id, rows })
          )
        )
      ).then((results) => ({
        rows: results.flatMap((r) => r.rows ?? []),
        failed: new Set(results.filter((r) => r.rows === null).map((r) => r.id)),
      }));

  const usagePromise = bulk
    ? safe("GET /vessels/data-usage/bulk/current", listCurrentDataUsage).then((m) => m ?? new Map<string, SlashDataUsage>())
    : Promise.all(vesselIds.map((id) => safe(`data-usage ${id}`, () => getVesselDataUsage(id)).then((u) => (u ? ([id, u] as const) : null)))).then(toMap);

  const locationPromise = bulk
    ? safe("GET /vessels/location/current", listCurrentLocations).then((m) => m ?? new Map<string, SlashLocation>())
    : Promise.all(vesselIds.map((id) => safe(`location ${id}`, () => getVesselLocation(id)).then((l) => (l ? ([id, l] as const) : null)))).then(toMap);

  const plansPromise = opts.detail || !bulk
    ? Promise.all(vesselIds.map((id) => safe(`service-plan ${id}`, () => getVesselServicePlan(id)).then((p) => (p ? ([id, p] as const) : null)))).then(toMap)
    : Promise.resolve(new Map<string, SlashServicePlan>());

  const historyPromise = opts.detail
    ? Promise.all(vesselIds.map((id) => safe(`location history ${id}`, () => getVesselLocationHistory(id)).then((h) => (h ? ([id, h] as const) : null)))).then(toMap)
    : Promise.resolve(new Map<string, SlashLocationHistoryPoint[]>());

  const [vessels, telemetryResult, usage, locations, plans, history] = await Promise.all([
    vesselsPromise,
    telemetryPromise,
    usagePromise,
    locationPromise,
    plansPromise,
    historyPromise,
  ]);

  const telemetryMap = new Map<string, SlashVesselLatestTelemetry>();
  for (const t of telemetryResult.rows) {
    if (t.deviceId) telemetryMap.set(t.deviceId, t);
    if (t.vesselId && !telemetryMap.has(t.vesselId)) telemetryMap.set(t.vesselId, t);
  }

  return {
    vessels,
    telemetry: telemetryMap,
    telemetryFailed: telemetryResult.failed,
    usage,
    locations,
    plans,
    history,
  };
}

function mapStatus(serviceLineActive: boolean, terminalActive: boolean): TerminalStatus {
  if (!serviceLineActive) return "SUSPENDED";
  if (!terminalActive) return "INACTIVE";
  return "ACTIVE";
}

function validCoordinate(lat: number | null | undefined, lng: number | null | undefined): boolean {
  return typeof lat === "number" && typeof lng === "number" && !(lat === 0 && lng === 0);
}

function mapLocation(
  location: SlashLocation | undefined,
  telemetry: SlashVesselLatestTelemetry | undefined
): TerminalRecord["location"] {
  if (location && validCoordinate(location.latitude, location.longitude)) {
    return { latitude: location.latitude, longitude: location.longitude, altitudeMeters: 0, accuracyMeters: 0, timestamp: location.timestamp };
  }
  if (telemetry && validCoordinate(telemetry.latitude, telemetry.longitude)) {
    return {
      latitude: telemetry.latitude as number,
      longitude: telemetry.longitude as number,
      altitudeMeters: 0,
      accuracyMeters: 0,
      timestamp: telemetry.latestTelemetryTimestamp ?? telemetry.lastSeenAt ?? new Date().toISOString(),
    };
  }
  return null; // no GPS fix reported
}

function mapLocationHistory(points: SlashLocationHistoryPoint[]): LocationHistoryPoint[] {
  return points
    .filter((p) => validCoordinate(p.latitude, p.longitude))
    .map((p, i) => ({
      id: `starlink-loc-${i}`,
      latitude: p.latitude,
      longitude: p.longitude,
      altitudeMeters: 0,
      accuracyMeters: 0,
      timestamp: p.timestamp,
    }));
}

function num(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function round(value: number | null, decimals = 1): number | null {
  if (value === null) return null;
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

function buildRecord(
  link: LiveLink,
  vessel: SlashVessel,
  terminal: SlashVessel["userTerminals"][number],
  sources: Sources
): TerminalRecord {
  const telemetry =
    sources.telemetry.get(terminal.userTerminalId) ??
    (terminal.dishSerialNumber ? sources.telemetry.get(terminal.dishSerialNumber) : undefined) ??
    (terminal.kitSerialNumber ? sources.telemetry.get(terminal.kitSerialNumber) : undefined) ??
    sources.telemetry.get(vessel.vesselId);
  const telemetryAvailable = !sources.telemetryFailed.has("*") && !sources.telemetryFailed.has(vessel.vesselId);
  const dataUsage = sources.usage.get(vessel.vesselId) ?? null;
  const servicePlan = sources.plans.get(vessel.vesselId) ?? null;

  const allowanceGB = servicePlan
    ? (servicePlan.allocatedDataGB ?? servicePlan.priorityDataGB ?? servicePlan.standardDataGB ?? null)
    : null;
  const monthlyUsageGB = dataUsage?.totalGB ?? 0;
  const excessGB = allowanceGB ? Math.max(0, monthlyUsageGB - allowanceGB) : 0;
  const status = mapStatus(vessel.serviceLineActive, terminal.active);

  const lastSeenAt = telemetry?.lastSeenAt ?? telemetry?.latestTelemetryTimestamp ?? null;
  const connectivity = deriveConnectivity({ telemetryAvailable, lastSeenAt });
  const dropRate = num(telemetry?.pingDropRateAvg);
  const downlink = round(num(telemetry?.downlinkThroughputMbps), 2);

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
      firmwareVersion: telemetry?.runningSoftwareVersion ?? "",
      antennaType: "",
      modemType: "",
      installedAccessories: [],
    },
    status,
    activation: {
      activationDate: servicePlan?.firstActivationDate ?? terminal.createdAt,
      deactivationDate: null,
      suspensionDate: null,
      reactivationDate: null,
      servicePlan: servicePlan?.planName ?? vessel.serviceLineProductReferenceId,
      assignedCustomerId: link.customerId,
      assignedCustomerName: link.customerName,
      assignedAccountId: link.accountId,
      assignedAccountNumber: link.accountNumber,
      serviceLineNumber: vessel.serviceLineNumber || null,
      displayName: vessel.serviceLineNickname || vessel.vesselName || null,
    },
    live: {
      onlineStatus: connectivity.onlineStatus,
      connectionState: connectivity.connectionState,
      signalStrengthDbm: null,
      signalQualityPct: round(num(telemetry?.signalQualityPercent), 0),
      dataSessionStatus: connectivity.onlineStatus === "ONLINE" ? "ACTIVE" : "NONE",
      lastSeenAt,
      statusReason: connectivity.statusReason,
    },
    location: mapLocation(sources.locations.get(vessel.vesselId), telemetry),
    locationHistory: mapLocationHistory(sources.history.get(vessel.vesselId) ?? []),
    usage: {
      // SLASH reports usage per service line (priority / standard), not
      // upload vs download.
      uploadBytes: 0,
      downloadBytes: 0,
      totalBytes: Math.round(monthlyUsageGB * 1e9),
      sessionBytes: 0,
      billingPeriodBytes: Math.round(monthlyUsageGB * 1e9),
      billingPeriodMonth: (dataUsage?.billingCycleStart ?? new Date().toISOString()).slice(0, 7),
      priorityBytes: dataUsage ? Math.round(dataUsage.priorityGB * 1e9) : undefined,
      standardBytes: dataUsage ? Math.round(dataUsage.standardGB * 1e9) : undefined,
    },
    network: {
      latencyMs: round(num(telemetry?.pingLatencyMsAvg), 0),
      // pingDropRateAvg is Starlink's pop ping drop rate, a 0–1 fraction.
      packetLossPct: dropRate === null ? null : round(dropRate * 100, 2),
      uptimePct: null,
      uptimeSeconds: num(telemetry?.uptimeSeconds),
      obstructionPct: round(num(telemetry?.obstructionPercentTime), 2),
      downtimeMinutesLast30d: null,
      bandwidthMbps: null,
      throughputMbps: downlink,
      downlinkThroughputMbps: downlink,
      uplinkThroughputMbps: round(num(telemetry?.uplinkThroughputMbps), 2),
      measuredAt: telemetry?.latestTelemetryTimestamp ?? telemetry?.lastSeenAt ?? null,
      linkQuality: null,
    },
    faults: [],
    alarms: [],
    health: {
      powerStatus: "UNKNOWN",
      temperatureCelsius: null,
      voltage: null,
      antennaAlignment: "UNKNOWN",
      modemStatus: "UNKNOWN",
      simStatus: "UNKNOWN",
      firmwareStatus: "UNKNOWN",
    },
    planBilling: {
      assignedPlan: servicePlan?.planName ?? vessel.serviceLineProductReferenceId,
      planAllowanceGB: allowanceGB,
      pooledDataGroup: null,
      monthlyUsageGB: Math.round(monthlyUsageGB * 100) / 100,
      excessUsageGB: Math.round(excessGB * 100) / 100,
      // Billing status lives on this app's invoices, not in Starlink.
      billingStatus: "CURRENT",
      serviceRestrictions: vessel.serviceLineActive ? [] : ["Service line inactive in Starlink account"],
    },
    auditHistory: [],
    dataRefreshRateSeconds: 60,
    sourceVesselId: vessel.vesselId,
    dataSource: "SLASH",
    pingDropRate: dropRate,
  };
}

function applyFilters(records: TerminalRecord[], filters?: TerminalListFilters): TerminalRecord[] {
  let result = records;
  if (filters?.q) {
    const q = filters.q.toLowerCase();
    result = result.filter(
      (r) =>
        r.identification.serialNumber.toLowerCase().includes(q) ||
        r.identification.hardwareId.toLowerCase().includes(q) ||
        (r.activation.displayName?.toLowerCase().includes(q) ?? false) ||
        (r.activation.assignedAccountNumber?.toLowerCase().includes(q) ?? false) ||
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

function buildAll(links: LiveLink[], sources: Sources): TerminalRecord[] {
  const records: TerminalRecord[] = [];
  for (const link of links) {
    const vessel = sources.vessels.get(link.vesselId);
    if (!vessel) continue;
    for (const terminal of vessel.userTerminals ?? []) {
      records.push(buildRecord(link, vessel, terminal, sources));
    }
  }
  return records;
}

export type LiveListResult = {
  records: TerminalRecord[];
  /** Linked vessels that could not be loaded from SLASH (API error / timeout). */
  failedVesselIds: string[];
};

export async function liveListTerminalsDetailed(filters?: TerminalListFilters): Promise<LiveListResult> {
  if (filters?.accountIds && filters.accountIds.length === 0) return { records: [], failedVesselIds: [] };
  const links = await safe("load account vessel links", () => loadLinks(filters));
  if (links === null) return { records: [], failedVesselIds: [] };

  const scoped = Boolean(filters?.accountIds || filters?.customerId);
  if (scoped) {
    if (links.length === 0) return { records: [], failedVesselIds: [] };
    const sources = await loadSources(
      links.map((l) => l.vesselId),
      { detail: false }
    );
    return {
      records: applyFilters(buildAll(links, sources), filters),
      failedVesselIds: links.filter((l) => !sources.vessels.has(l.vesselId)).map((l) => l.vesselId),
    };
  }

  // Admin fleet view: every vessel in the SLASH tenant, linked or not.
  const allVessels = await safe("GET /vessels", listVessels);
  if (!allVessels) return { records: [], failedVesselIds: links.map((l) => l.vesselId) };
  const linked = new Map(links.map((l) => [l.vesselId, l]));
  const fleetLinks: LiveLink[] = allVessels.map(
    (v) =>
      linked.get(v.vesselId) ?? {
        accountId: null,
        accountNumber: null,
        customerId: null,
        customerName: null,
        vesselId: v.vesselId,
      }
  );
  const sources = await loadSources(
    fleetLinks.map((l) => l.vesselId),
    { detail: false, allVessels }
  );
  return { records: applyFilters(buildAll(fleetLinks, sources), filters), failedVesselIds: [] };
}

export async function liveListTerminals(filters?: TerminalListFilters): Promise<TerminalRecord[]> {
  return (await liveListTerminalsDetailed(filters)).records;
}

/** Full detail (service plan + location history) for one user terminal. */
export async function liveGetTerminal(id: string): Promise<TerminalRecord | null> {
  const allVessels = await safe("GET /vessels", listVessels);
  const vessel = allVessels?.find((v) => (v.userTerminals ?? []).some((t) => t.userTerminalId === id));
  if (!vessel) return null;

  const account = await safe("load vessel owner", async () => {
    await connectDB();
    return CustomerAccount.findOne({ starlinkVesselIds: vessel.vesselId }).select("accountNumber customer").lean();
  });
  let link: LiveLink = { accountId: null, accountNumber: null, customerId: null, customerName: null, vesselId: vessel.vesselId };
  if (account) {
    const owner = await User.findById(account.customer).select("name company").lean();
    link = {
      accountId: account._id.toString(),
      accountNumber: account.accountNumber,
      customerId: account.customer.toString(),
      customerName: owner ? owner.company || owner.name : null,
      vesselId: vessel.vesselId,
    };
  }

  const sources = await loadSources([vessel.vesselId], { detail: true, allVessels: [vessel] });
  const terminal = vessel.userTerminals.find((t) => t.userTerminalId === id);
  return terminal ? buildRecord(link, vessel, terminal, sources) : null;
}
