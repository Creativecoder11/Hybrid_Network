// Shapes below follow the official SLASH API specification (the Swagger 2.0
// document embedded in https://slash-prod.web.app/docs — a client-rendered
// page, so the spec was extracted from its shipped bundle; see
// docs/slash-api-integration-plan.md §10). Fields are typed optional/nullable
// wherever the spec says they may be omitted or null.

export type SlashUserTerminal = {
  userTerminalId: string;
  kitSerialNumber: string;
  dishSerialNumber: string;
  status: string;
  active: boolean;
  createdAt: string;
};

export type SlashVessel = {
  vesselId: string;
  vesselName: string;
  vesselSerialNumber: string;
  tenantName: string;
  status: string;
  serviceLineNumber: string;
  serviceLineNickname: string;
  serviceLineActive: boolean;
  serviceLineAddressReferenceId: string;
  serviceLineProductReferenceId: string;
  dataOptInEnabled: boolean;
  publicIpEnabled: boolean;
  userTerminals: SlashUserTerminal[];
  insertedAt: string;
};

export type SlashVesselListResponse = {
  vessels: SlashVessel[];
  totalCount: number;
  page: number;
  limit: number;
};

export type SlashDataUsage = {
  priorityGB: number;
  standardGB: number;
  optInPriorityGB: number;
  nonBillableGB: number;
  totalGB: number;
  billingCycleStart: string;
  billingCycleEnd: string;
  lastUpdatedAt: string | null;
};

export type SlashVesselDataUsageResponse = {
  vesselId: string;
  dataUsage: SlashDataUsage;
};

// Per the official spec (models.ServicePlan): fields the upstream data
// doesn't expose are null/omitted rather than defaulted.
export type SlashServicePlan = {
  planName: string;
  priorityDataGB: number | null;
  standardDataGB: number | null;
  /** Data allocated for the current cycle, pro-rated for a mid-cycle start. */
  allocatedDataGB?: number | null;
  blockDataGB?: number | null;
  topUpDataGB?: number | null;
  price: number | null;
  currency: string;
  isOptedIntoOverage: boolean;
  overageName?: string | null;
  overageDescription?: string | null;
  billingCycleStart: string;
  billingCycleEnd: string;
  autoRenew: boolean | null;
  currentActivationDate?: string | null;
  firstActivationDate?: string | null;
  subscriptionEndDate?: string | null;
};

export type SlashVesselServicePlanResponse = {
  vesselId: string;
  servicePlan: SlashServicePlan;
};

export type SlashLocation = {
  latitude: number;
  longitude: number;
  timestamp: string;
  h3CellId: string;
  marineRegionName?: string;
  marineRegionType?: string;
  marineRegionDescription?: string;
};

export type SlashVesselLocationResponse = {
  vesselId: string;
  location: SlashLocation;
};

export type SlashLocationHistoryPoint = SlashLocation;

export type SlashVesselLocationHistoryResponse = {
  vesselId: string;
  timeRange: { startDate: string; endDate: string };
  historyPoints: SlashLocationHistoryPoint[] | null;
  totalCount: number;
  page: number;
  limit: number;
};

export type SlashVesselConnectivityStatusResponse = {
  vesselId: string;
  timestamp: string;
  connectivityStats: unknown[];
};

// GET /alerts/user-terminals — one alert EPISODE per (device, account, alert)
// in the requested window (models.UserTerminalAlert in the official spec).
export type SlashAlertEpisode = {
  accountNumber?: string;
  active?: boolean;
  alertDescription?: string;
  alertId?: number;
  alertName?: string;
  deviceId?: string;
  firstSeen?: string;
  lastSeen?: string;
  sampleCount?: number;
  timestamp?: string;
};

// GET /telemetry/vessels/latest — latest telemetry row per (vessel, device)
// (models.VesselLatestTelemetry). `stale` is relative to the request's
// timeRangeHours window; lastSeenAt is null when the device has been silent
// for longer than the 7-day retention of the latest-telemetry view.
export type SlashVesselLatestTelemetry = {
  vesselId: string;
  vesselName?: string;
  vesselSerialNumber?: string;
  serviceLineNumber?: string;
  deviceId: string;
  stale?: boolean;
  lastSeenAt?: string | null;
  latestTelemetryTimestamp?: string | null;
  signalQualityPercent?: number | null;
  downlinkThroughputMbps?: number | null;
  uplinkThroughputMbps?: number | null;
  pingLatencyMsAvg?: number | null;
  pingDropRateAvg?: number | null;
  obstructionPercentTime?: number | null;
  uptimeSeconds?: number | null;
  runningSoftwareVersion?: string | null;
  secondsUntilSwupdateRebootPossible?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  h3CellId?: string | null;
  marineRegionName?: string | null;
  activeAlertCount?: number | null;
  terminalAlertName?: string | null;
  terminalAlertDescription?: string | null;
  latestTerminalAlertTimestamp?: string | null;
};

export type SlashVesselLatestTelemetryResponse = {
  data: SlashVesselLatestTelemetry[] | null;
  pageIndex: number;
  pageSize: number;
  totalCount: number;
};

// GET /vessels/{vesselId}/data-usage/history — one point per day.
export type SlashDataUsageHistoryPoint = {
  date: string;
  priorityGB: number;
  standardGB: number;
  optInPriorityGB: number;
  nonBillableGB: number;
  totalGB: number;
  lastUpdatedAt?: string | null;
};

export type SlashVesselDataUsageHistoryResponse = {
  vesselId: string;
  timeRange: { startDate: string; endDate: string };
  historyPoints: SlashDataUsageHistoryPoint[] | null;
  totalCount: number;
  page: number;
  limit: number;
};

export type SlashAllVesselsLocationResponse = {
  totalCount: number;
  vessels: { vesselId: string; vesselName?: string; location: SlashLocation }[] | null;
};

export type SlashUserTerminalAlertsResponse = {
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  data: SlashAlertEpisode[] | null;
};

export type SlashAddress = {
  addressReferenceId: string;
  accountNumber: string;
  addressLines: string[];
  locality: string;
  administrativeArea: string;
  administrativeAreaCode: string;
  region: string;
  regionCode: string;
  postalCode: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  insertedAt: string;
};

export type SlashAddressListResponse = {
  addresses: SlashAddress[];
};

export type SlashServiceLine = {
  serviceLineNumber: string;
  accountNumber: string;
  addressReferenceId: string;
  nickname: string;
  productReferenceId: string;
  delayedProductId: string | null;
  optInProductId: string | null;
  startDate: string;
  endDate: string | null;
  publicIp: boolean;
  active: boolean;
};

export type SlashServiceLineListResponse = {
  serviceLines: SlashServiceLine[];
  totalCount: number;
  page: number;
  limit: number;
};
