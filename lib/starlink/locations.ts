import "server-only";
import { starlinkFetch } from "./client";
import { validateSlashResponse } from "./validate";
import {
  slashVesselLocationResponseSchema,
  slashVesselLocationHistoryResponseSchema,
  slashAllVesselsLocationResponseSchema,
} from "./schemas";
import type {
  SlashLocation,
  SlashLocationHistoryPoint,
  SlashVesselLocationResponse,
  SlashVesselLocationHistoryResponse,
  SlashAllVesselsLocationResponse,
} from "./types";

export async function getVesselLocation(vesselId: string): Promise<SlashLocation> {
  const raw = await starlinkFetch<SlashVesselLocationResponse>(
    `/vessels/${encodeURIComponent(vesselId)}/location/current`,
    { revalidateSeconds: 30 }
  );
  const res = validateSlashResponse(slashVesselLocationResponseSchema, raw, "GET vessel location/current");
  return res.location;
}

/** Current location of every vessel in one call (GET /vessels/location/current). */
export async function listCurrentLocations(): Promise<Map<string, SlashLocation>> {
  const raw = await starlinkFetch<SlashAllVesselsLocationResponse>("/vessels/location/current", {
    query: { includeInactive: true },
    revalidateSeconds: 30,
  });
  const res = validateSlashResponse(slashAllVesselsLocationResponseSchema, raw, "GET /vessels/location/current");
  const map = new Map<string, SlashLocation>();
  for (const v of res.vessels ?? []) {
    if (v?.vesselId && v.location) map.set(v.vesselId, v.location);
  }
  return map;
}

export type LocationHistoryParams = {
  /** RFC3339 or YYYY-MM-DD; defaults to 7 days ago on the API side. Max range 2 months. */
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
};

/** Accepts YYYY-MM-DD from date inputs and widens it to the RFC3339 the API requires. */
function toRfc3339(value: string | undefined, endOfDay: boolean): string | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T${endOfDay ? "23:59:59" : "00:00:00"}Z`;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export async function getVesselLocationHistory(
  vesselId: string,
  params?: LocationHistoryParams
): Promise<SlashLocationHistoryPoint[]> {
  const raw = await starlinkFetch<SlashVesselLocationHistoryResponse>(
    `/vessels/${encodeURIComponent(vesselId)}/location/history`,
    {
      query: {
        startDate: toRfc3339(params?.startDate, false),
        endDate: toRfc3339(params?.endDate, true),
        page: params?.page,
        limit: params?.limit ?? 100,
      },
      revalidateSeconds: 60,
    }
  );
  const res = validateSlashResponse(slashVesselLocationHistoryResponseSchema, raw, "GET vessel location/history");
  return res.historyPoints ?? [];
}
