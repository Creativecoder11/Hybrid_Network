import "server-only";
import { starlinkFetch } from "./client";
import { validateSlashResponse } from "./validate";
import { slashVesselDataUsageResponseSchema } from "./schemas";
import type { SlashDataUsage, SlashVesselDataUsageResponse } from "./types";

// /data-usage/history and /data-blocks are NOT CONFIRMED against this
// tenant's API surface (see docs/slash-api-integration-plan.md) — only the
// "current" snapshot is implemented here. No history/blocks function exists
// to call; UI that wants them shows a disabled "not supported" state instead
// of a function that would 404.
export async function getVesselDataUsage(vesselId: string): Promise<SlashDataUsage> {
  const raw = await starlinkFetch<SlashVesselDataUsageResponse>(
    `/vessels/${encodeURIComponent(vesselId)}/data-usage/current`
  );
  const res = validateSlashResponse(slashVesselDataUsageResponseSchema, raw, "GET vessel data-usage/current");
  return res.dataUsage;
}
