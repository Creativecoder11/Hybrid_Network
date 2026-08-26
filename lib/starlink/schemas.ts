import { z } from "zod";

// Runtime validation for the SLASH API responses this app actually calls.
// Mirrors lib/starlink/types.ts. Kept loose on fields whose populated shape
// has never been observed (e.g. connectivityStats, alert episodes) — see
// the comments in types.ts for why.

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
  lastUpdatedAt: z.string(),
});

export const slashVesselDataUsageResponseSchema = z.object({
  vesselId: z.string(),
  dataUsage: slashDataUsageSchema,
});

export const slashServicePlanSchema = z.object({
  planName: z.string(),
  priorityDataGB: z.number().nullable(),
  standardDataGB: z.number().nullable(),
  price: z.number().nullable(),
  currency: z.string(),
  isOptedIntoOverage: z.boolean(),
  overageName: z.string().nullable(),
  overageDescription: z.string().nullable(),
  billingCycleStart: z.string(),
  billingCycleEnd: z.string(),
  autoRenew: z.boolean().nullable(),
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

// Every alert-episode field is optional: the sandbox tenant has never
// produced a populated one, so this only guarantees "some object," not a
// specific shape.
export const slashAlertEpisodeSchema = z.looseObject({
  id: z.string().optional(),
  userTerminalId: z.string().optional(),
  vesselId: z.string().optional(),
  type: z.string().optional(),
  message: z.string().optional(),
  severity: z.string().optional(),
  startedAt: z.string().optional(),
  endedAt: z.string().nullable().optional(),
});

export const slashUserTerminalAlertsResponseSchema = z.object({
  totalCount: z.number(),
  pageIndex: z.number(),
  pageSize: z.number(),
  data: z.array(slashAlertEpisodeSchema).nullable(),
});
