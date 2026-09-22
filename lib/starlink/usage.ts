import "server-only";
import { starlinkFetch } from "./client";
import { validateSlashResponse } from "./validate";
import { slashVesselDataUsageResponseSchema, slashVesselDataUsageHistoryResponseSchema } from "./schemas";
import type {
  SlashDataUsage,
  SlashDataUsageHistoryPoint,
  SlashVesselDataUsageResponse,
  SlashVesselDataUsageHistoryResponse,
} from "./types";

// Current billing-cycle usage per vessel, plus daily history (max 2-month
// window per request, max 100 points per page).

export async function getVesselDataUsage(vesselId: string): Promise<SlashDataUsage> {
  const raw = await starlinkFetch<SlashVesselDataUsageResponse>(
    `/vessels/${encodeURIComponent(vesselId)}/data-usage/current`,
    { revalidateSeconds: 60 }
  );
  const res = validateSlashResponse(slashVesselDataUsageResponseSchema, raw, "GET vessel data-usage/current");
  return res.dataUsage;
}

type BulkUsageResponse = {
  vessels: { vesselId: string; vesselName?: string; dataUsage: SlashDataUsage }[] | null;
  totalCount: number;
};

/** Current-cycle usage for every vessel in one call (GET /vessels/data-usage/bulk/current). */
export async function listCurrentDataUsage(): Promise<Map<string, SlashDataUsage>> {
  const raw = await starlinkFetch<BulkUsageResponse>("/vessels/data-usage/bulk/current", {
    query: { includeInactive: true },
    revalidateSeconds: 60,
  });
  const map = new Map<string, SlashDataUsage>();
  for (const v of raw?.vessels ?? []) {
    if (v?.vesselId && v.dataUsage) map.set(v.vesselId, v.dataUsage);
  }
  return map;
}

const HISTORY_PAGE_LIMIT = 100;
const MAX_RANGE_MS = 60 * 24 * 60 * 60 * 1000; // API maximum: 2 months

/**
 * Daily usage points between startDate and endDate (RFC3339). Ranges longer
 * than the API's 2-month maximum are clamped to the most recent 60 days.
 */
export async function getVesselDataUsageHistory(
  vesselId: string,
  range?: { startDate?: Date; endDate?: Date }
): Promise<SlashDataUsageHistoryPoint[]> {
  const end = range?.endDate ?? new Date();
  let start = range?.startDate ?? new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (end.getTime() - start.getTime() > MAX_RANGE_MS) start = new Date(end.getTime() - MAX_RANGE_MS);

  const points: SlashDataUsageHistoryPoint[] = [];
  for (let page = 0; page < 10; page++) {
    const raw = await starlinkFetch<SlashVesselDataUsageHistoryResponse>(
      `/vessels/${encodeURIComponent(vesselId)}/data-usage/history`,
      {
        query: { startDate: start.toISOString(), endDate: end.toISOString(), limit: HISTORY_PAGE_LIMIT, page },
        revalidateSeconds: 300,
      }
    );
    const res = validateSlashResponse(slashVesselDataUsageHistoryResponseSchema, raw, "GET vessel data-usage/history");
    const batch = res.historyPoints ?? [];
    points.push(...batch);
    if (batch.length < HISTORY_PAGE_LIMIT || points.length >= res.totalCount) break;
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}
