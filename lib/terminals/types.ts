// The normalized device contract every page and export reads. The SLASH
// adapter (lib/terminals/liveProvider.ts) builds these from real API data;
// nothing above lib/terminals/service.ts ever sees a raw SLASH response.
//
// Convention: a metric the API did not provide is `null` (rendered as "Not
// available"), never 0 or a made-up default — 0 is a real reading.

export type TerminalStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "DEACTIVATED"
  | "SUSPENDED"
  | "PENDING_ACTIVATION"
  | "CANCELLED";

export type TerminalIdentification = {
  serialNumber: string;
  imei: string;
  iccid: string;
  hardwareId: string;
  supplierAssetId: string;
  customerAssetReference: string;
};

export type TerminalProduct = {
  model: string;
  manufacturer: string;
  hardwareVersion: string;
  firmwareVersion: string;
  antennaType: string;
  modemType: string;
  installedAccessories: string[];
};

export type TerminalActivation = {
  activationDate: string | null;
  deactivationDate: string | null;
  suspensionDate: string | null;
  reactivationDate: string | null;
  servicePlan: string;
  /** Customer Profile (User id) the device belongs to. */
  assignedCustomerId: string | null;
  assignedCustomerName: string | null;
  /** Customer Account the device's vessel is linked to. */
  assignedAccountId: string | null;
  assignedAccountNumber: string | null;
  serviceLineNumber: string | null;
  /** Vessel / service-line nickname from SLASH, used as the terminal's display name. */
  displayName: string | null;
};

export type OnlineStatus = "ONLINE" | "OFFLINE" | "UNKNOWN";
export type ConnectionState = "CONNECTED" | "CONNECTING" | "IDLE" | "DISCONNECTED" | "UNKNOWN";
export type DataSessionStatus = "ACTIVE" | "IDLE" | "NONE";

export type TerminalLiveData = {
  /**
   * ONLINE: telemetry received within the online threshold (see
   * lib/terminals/status.ts). OFFLINE: telemetry exists but is older.
   * UNKNOWN: no telemetry could be read for this device.
   */
  onlineStatus: OnlineStatus;
  connectionState: ConnectionState;
  /** Starlink does not report dBm — null for SLASH devices. */
  signalStrengthDbm: number | null;
  signalQualityPct: number | null;
  dataSessionStatus: DataSessionStatus;
  /** Last telemetry sample time; null when the device has never reported. */
  lastSeenAt: string | null;
  /** Plain-language explanation of onlineStatus, e.g. "Last telemetry 4 min ago". */
  statusReason: string;
};

export type GpsLocation = {
  latitude: number;
  longitude: number;
  altitudeMeters: number;
  timestamp: string;
  accuracyMeters: number;
};

export type LocationHistoryPoint = GpsLocation & { id: string };

export type UsageStats = {
  uploadBytes: number;
  downloadBytes: number;
  totalBytes: number;
  sessionBytes: number;
  billingPeriodBytes: number;
  billingPeriodMonth: string;
  /** Starlink-specific priority/standard data split — only set for live (SLASH-sourced) terminals. */
  priorityBytes?: number;
  standardBytes?: number;
};

export type LinkQuality = "EXCELLENT" | "GOOD" | "FAIR" | "POOR";

export type NetworkPerformance = {
  latencyMs: number | null;
  packetLossPct: number | null;
  uptimePct: number | null;
  /** Seconds since the terminal last booted (SLASH uptimeSeconds). */
  uptimeSeconds: number | null;
  obstructionPct: number | null;
  downtimeMinutesLast30d: number | null;
  bandwidthMbps: number | null;
  /** Kept for existing summaries: equals downlinkThroughputMbps. */
  throughputMbps: number | null;
  downlinkThroughputMbps: number | null;
  uplinkThroughputMbps: number | null;
  /** When the throughput/latency readings above were sampled. */
  measuredAt: string | null;
  /** Not reported by SLASH — null for live devices rather than a guess. */
  linkQuality: LinkQuality | null;
};

export type FaultSeverity = "CRITICAL" | "MAJOR" | "MINOR" | "WARNING";
export type FaultStatus = "OPEN" | "ACKNOWLEDGED" | "CLEARED";

export type TerminalFault = {
  id: string;
  code: string;
  description: string;
  severity: FaultSeverity;
  status: FaultStatus;
  startTime: string;
  clearTime: string | null;
};

export type AlarmType =
  | "OFFLINE"
  | "DEGRADED_SERVICE"
  | "HARDWARE_FAULT"
  | "GPS_FAILURE"
  | "HIGH_USAGE"
  | "PLAN_LIMIT"
  | "SUSPENSION";

export type TerminalAlarm = {
  id: string;
  type: AlarmType;
  message: string;
  triggeredAt: string;
  acknowledged: boolean;
};

export type OkFaultUnknown = "OK" | "FAULT" | "UNKNOWN";

// Hardware health isn't exposed by SLASH for Starlink terminals, so live
// devices report UNKNOWN / null here rather than an invented "OK".
export type TerminalHealth = {
  powerStatus: OkFaultUnknown;
  temperatureCelsius: number | null;
  voltage: number | null;
  antennaAlignment: "ALIGNED" | "MISALIGNED" | "UNKNOWN";
  modemStatus: "OK" | "FAULT" | "UNKNOWN";
  simStatus: "OK" | "FAULT" | "NOT_DETECTED" | "UNKNOWN";
  firmwareStatus: "UP_TO_DATE" | "UPDATE_AVAILABLE" | "UPDATING" | "UNKNOWN";
};

export type BillingStatus = "CURRENT" | "OVERDUE" | "SUSPENDED_FOR_NONPAYMENT";

export type TerminalPlanBilling = {
  assignedPlan: string;
  planAllowanceGB: number | null;
  pooledDataGroup: string | null;
  monthlyUsageGB: number;
  excessUsageGB: number;
  billingStatus: BillingStatus;
  serviceRestrictions: string[];
};

export type TerminalAuditEntry = {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  details: string;
};

export type TerminalRecord = {
  id: string; // stable identifier = ICCID, used across list/detail/commands
  identification: TerminalIdentification;
  product: TerminalProduct;
  status: TerminalStatus;
  activation: TerminalActivation;
  live: TerminalLiveData;
  location: GpsLocation | null;
  locationHistory: LocationHistoryPoint[];
  usage: UsageStats;
  network: NetworkPerformance;
  faults: TerminalFault[];
  alarms: TerminalAlarm[];
  health: TerminalHealth;
  planBilling: TerminalPlanBilling;
  auditHistory: TerminalAuditEntry[];
  dataRefreshRateSeconds: number;
  /**
   * Set only for terminals sourced from the real Starlink/SLASH API
   * (see lib/terminals/liveProvider.ts). Lets the command layer route
   * REBOOT to the real `reboot_user_terminal` passthrough action instead of
   * the local-only simulation used for demo terminals.
   */
  sourceVesselId?: string;
  /** "SLASH" = real API data; "DEMO" = generated demo data (ENABLE_DEMO_TERMINALS only). */
  dataSource: "SLASH" | "DEMO";
  /** Raw SLASH ping drop rate (0–1 fraction), kept alongside packetLossPct for exports. */
  pingDropRate?: number | null;
};

export type TerminalListFilters = {
  q?: string;
  status?: TerminalStatus | "ALL";
  customerId?: string;
  /** Restrict to devices linked to these Customer Accounts. */
  accountIds?: string[];
  faultStatus?: FaultStatus | "ANY";
  gpsRegion?: string;
  lastOnlineWithinHours?: number;
};

export const REMOTE_COMMANDS = [
  "REBOOT",
  "REFRESH_SERVICE",
  "SUSPEND",
  "REACTIVATE",
  "UPDATE_FIRMWARE",
  "REQUEST_DIAGNOSTICS",
] as const;
export type RemoteCommandType = (typeof REMOTE_COMMANDS)[number];

/**
 * The interface a terminal data source must satisfy. lib/terminals/mockProvider.ts
 * implements this today; swap the import in lib/terminals/service.ts for a real
 * implementation once the client's API is available and nothing else changes.
 */
export interface TerminalProvider {
  list(filters?: TerminalListFilters): Promise<TerminalRecord[]>;
  get(id: string): Promise<TerminalRecord | null>;
  sendCommand(id: string, command: RemoteCommandType, actorName: string): Promise<TerminalRecord>;
}
