// Types mirror the client's future Terminal Hardware & Live Service Data API
// one-for-one. This file is the "contract" — lib/terminals/mockProvider.ts
// satisfies it with generated data today; a future lib/terminals/liveProvider.ts
// will satisfy it with real API calls, and nothing above the service layer
// (Server Actions, pages, components) needs to change when that swap happens.

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
  assignedCustomerId: string | null;
  assignedCustomerName: string | null;
};

export type ConnectionState = "CONNECTED" | "CONNECTING" | "IDLE" | "DISCONNECTED";
export type DataSessionStatus = "ACTIVE" | "IDLE" | "NONE";

export type TerminalLiveData = {
  onlineStatus: "ONLINE" | "OFFLINE";
  connectionState: ConnectionState;
  signalStrengthDbm: number;
  signalQualityPct: number;
  dataSessionStatus: DataSessionStatus;
  lastSeenAt: string;
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
  latencyMs: number;
  packetLossPct: number;
  uptimePct: number;
  downtimeMinutesLast30d: number;
  bandwidthMbps: number;
  throughputMbps: number;
  linkQuality: LinkQuality;
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

export type TerminalHealth = {
  powerStatus: OkFaultUnknown;
  temperatureCelsius: number;
  voltage: number;
  antennaAlignment: "ALIGNED" | "MISALIGNED" | "UNKNOWN";
  modemStatus: "OK" | "FAULT";
  simStatus: "OK" | "FAULT" | "NOT_DETECTED";
  firmwareStatus: "UP_TO_DATE" | "UPDATE_AVAILABLE" | "UPDATING";
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
   * the local-only simulation used for mock terminals. Undefined for mock
   * terminals.
   */
  sourceVesselId?: string;
};

export type TerminalListFilters = {
  q?: string;
  status?: TerminalStatus | "ALL";
  customerId?: string;
  faultStatus?: FaultStatus | "ANY";
  gpsRegion?: string;
  lastOnlineWithinHours?: number;
};

export type RemoteCommandType =
  | "REBOOT"
  | "REFRESH_SERVICE"
  | "SUSPEND"
  | "REACTIVATE"
  | "UPDATE_FIRMWARE"
  | "REQUEST_DIAGNOSTICS";

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
