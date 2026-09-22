import { z } from "zod";

// Runtime validation for the SLASH API responses this app actually calls.
// Mirrors lib/starlink/types.ts (official spec). looseObject where the spec
// allows extra/omitted fields so a new upstream field never breaks a page.

export const slashUserTerminalSchema = z.object({
  userTerminalId: z.string(),
  kitSerialNumber: z.string(),
  dishSerialNumber: z.string(),
  status: z.string(),
  active: z.boolean(),
  createdAt: z.string(),
});

export const slashVesselSchema = z.object({
  vesselId: z.string(),
  vesselName: z.string(),
  vesselSerialNumber: z.string(),
  tenantName: z.string(),
  status: z.string(),
  serviceLineNumber: z.string(),
  serviceLineNickname: z.string(),
  serviceLineActive: z.boolean(),
  serviceLineAddressReferenceId: z.string(),
  serviceLineProductReferenceId: z.string(),
  dataOptInEnabled: z.boolean(),
  publicIpEnabled: z.boolean(),
  userTerminals: z.array(slashUserTerminalSchema),
  insertedAt: z.string(),
});

export const slashVesselListResponseSchema = z.object({
  vessels: z.array(slashVesselSchema),
  totalCount: z.number(),
  page: z.number(),
  limit: z.number(),
});

export const slashDataUsageSchema = z.object({
  priorityGB: z.number(),
  standardGB: z.number(),
  optInPriorityGB: z.number(),
  nonBillableGB: z.number(),
  totalGB: z.number(),
  billingCycleStart: z.string(),
  billingCycleEnd: z.string(),
  // "null if no data available" per the spec.
  lastUpdatedAt: z.string().nullable(),
});

export const slashVesselDataUsageResponseSchema = z.object({
  vesselId: z.string(),
  dataUsage: slashDataUsageSchema,
});

export const slashServicePlanSchema = z.looseObject({
  planName: z.string(),
  priorityDataGB: z.number().nullable(),
  standardDataGB: z.number().nullable(),
  allocatedDataGB: z.number().nullable().optional(),
  blockDataGB: z.number().nullable().optional(),
  topUpDataGB: z.number().nullable().optional(),
  price: z.number().nullable(),
  currency: z.string(),
  isOptedIntoOverage: z.boolean(),
  overageName: z.string().nullable().optional(),
  overageDescription: z.string().nullable().optional(),
  billingCycleStart: z.string(),
  billingCycleEnd: z.string(),
  autoRenew: z.boolean().nullable(),
  currentActivationDate: z.string().nullable().optional(),
  firstActivationDate: z.string().nullable().optional(),
  subscriptionEndDate: z.string().nullable().optional(),
});

export const slashVesselServicePlanResponseSchema = z.object({
  vesselId: z.string(),
  servicePlan: slashServicePlanSchema,
});

export const slashLocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timestamp: z.string(),
  h3CellId: z.string(),
  marineRegionName: z.string().optional(),
  marineRegionType: z.string().optional(),
  marineRegionDescription: z.string().optional(),
});

export const slashVesselLocationResponseSchema = z.object({
  vesselId: z.string(),
  location: slashLocationSchema,
});

export const slashVesselLocationHistoryResponseSchema = z.object({
  vesselId: z.string(),
  timeRange: z.object({ startDate: z.string(), endDate: z.string() }),
  historyPoints: z.array(slashLocationSchema).nullable(),
  totalCount: z.number(),
  page: z.number(),
  limit: z.number(),
});

// connectivityStats' populated shape is unconfirmed (always empty in
// practice) — validated as an array of unknown records rather than guessed.
export const slashVesselConnectivityStatusResponseSchema = z.object({
  vesselId: z.string(),
  timestamp: z.string(),
  connectivityStats: z.array(z.unknown()),
});

// models.UserTerminalAlert (alert EPISODE) per the official spec.
export const slashAlertEpisodeSchema = z.looseObject({
  accountNumber: z.string().optional(),
  active: z.boolean().optional(),
  alertDescription: z.string().optional(),
  alertId: z.number().optional(),
  alertName: z.string().optional(),
  deviceId: z.string().optional(),
  firstSeen: z.string().optional(),
  lastSeen: z.string().optional(),
  sampleCount: z.number().optional(),
  timestamp: z.string().optional(),
});

export const slashUserTerminalAlertsResponseSchema = z.object({
  totalCount: z.number(),
  pageIndex: z.number(),
  pageSize: z.number(),
  data: z.array(slashAlertEpisodeSchema).nullable(),
});

const optionalNumber = z.number().nullable().optional();
const optionalString = z.string().nullable().optional();

export const slashVesselLatestTelemetrySchema = z.looseObject({
  vesselId: z.string(),
  deviceId: z.string(),
  stale: z.boolean().optional(),
  lastSeenAt: optionalString,
  latestTelemetryTimestamp: optionalString,
  signalQualityPercent: optionalNumber,
  downlinkThroughputMbps: optionalNumber,
  uplinkThroughputMbps: optionalNumber,
  pingLatencyMsAvg: optionalNumber,
  pingDropRateAvg: optionalNumber,
  obstructionPercentTime: optionalNumber,
  uptimeSeconds: optionalNumber,
  runningSoftwareVersion: optionalString,
  latitude: optionalNumber,
  longitude: optionalNumber,
});

export const slashVesselLatestTelemetryResponseSchema = z.object({
  data: z.array(slashVesselLatestTelemetrySchema).nullable(),
  pageIndex: z.number(),
  pageSize: z.number(),
  totalCount: z.number(),
});

export const slashDataUsageHistoryPointSchema = z.looseObject({
  date: z.string(),
  priorityGB: z.number(),
  standardGB: z.number(),
  optInPriorityGB: z.number(),
  nonBillableGB: z.number(),
  totalGB: z.number(),
  lastUpdatedAt: optionalString,
});

export const slashVesselDataUsageHistoryResponseSchema = z.object({
  vesselId: z.string(),
  timeRange: z.object({ startDate: z.string(), endDate: z.string() }),
  historyPoints: z.array(slashDataUsageHistoryPointSchema).nullable(),
  totalCount: z.number(),
  page: z.number(),
  limit: z.number(),
});

export const slashAllVesselsLocationResponseSchema = z.object({
  totalCount: z.number(),
  vessels: z
    .array(z.looseObject({ vesselId: z.string(), vesselName: z.string().optional(), location: slashLocationSchema }))
    .nullable(),
});
