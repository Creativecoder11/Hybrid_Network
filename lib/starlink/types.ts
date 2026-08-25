// Shapes below are transcribed from live responses recorded against the real
// SLASH API (https://slash-api.rudra.sh/api/v1) during integration, not from
// the (client-rendered, non-static) docs page. Fields the sandbox tenant's
// single test device always returned empty/zero (e.g. connectivityStats) are
// typed loosely since their populated shape hasn't been observed yet.

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
  lastUpdatedAt: string;
};

export type SlashVesselDataUsageResponse = {
  vesselId: string;
  dataUsage: SlashDataUsage;
};

export type SlashServicePlan = {
  planName: string;
  priorityDataGB: number | null;
  standardDataGB: number | null;
  price: number | null;
  currency: string;
  isOptedIntoOverage: boolean;
  overageName: string | null;
  overageDescription: string | null;
  billingCycleStart: string;
  billingCycleEnd: string;
  autoRenew: boolean | null;
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

export type SlashAlertEpisode = {
  id?: string;
  userTerminalId?: string;
  vesselId?: string;
  type?: string;
  message?: string;
  severity?: string;
  startedAt?: string;
  endedAt?: string | null;
  [key: string]: unknown;
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
