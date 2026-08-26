import "server-only";
import { starlinkFetch } from "./client";
import { validateSlashResponse } from "./validate";
import { slashVesselLocationResponseSchema, slashVesselLocationHistoryResponseSchema } from "./schemas";
import type { SlashLocation, SlashLocationHistoryPoint, SlashVesselLocationResponse, SlashVesselLocationHistoryResponse } from "./types";

export async function getVesselLocation(vesselId: string): Promise<SlashLocation> {
  const raw = await starlinkFetch<SlashVesselLocationResponse>(
    `/vessels/${encodeURIComponent(vesselId)}/location/current`
  );
  const res = validateSlashResponse(slashVesselLocationResponseSchema, raw, "GET vessel location/current");
  return res.location;
}

export type LocationHistoryParams = {
  startDate?: string; // ISO date — passed through as-is, date-range limits on the API side are NOT CONFIRMED
  endDate?: string;
  page?: number;
  limit?: number;
};

export async function getVesselLocationHistory(
  vesselId: string,
  params?: LocationHistoryParams
): Promise<SlashLocationHistoryPoint[]> {
  const raw = await starlinkFetch<SlashVesselLocationHistoryResponse>(
    `/vessels/${encodeURIComponent(vesselId)}/location/history`,
    { query: { startDate: params?.startDate, endDate: params?.endDate, page: params?.page, limit: params?.limit } }
  );
  const res = validateSlashResponse(slashVesselLocationHistoryResponseSchema, raw, "GET vessel location/history");
  return res.historyPoints ?? [];
}
