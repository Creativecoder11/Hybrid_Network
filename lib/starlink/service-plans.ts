import "server-only";
import { starlinkFetch } from "./client";
import { validateSlashResponse } from "./validate";
import { slashVesselServicePlanResponseSchema } from "./schemas";
import type { SlashServicePlan, SlashVesselServicePlanResponse } from "./types";

// /service-plan/history is NOT CONFIRMED — only the current plan snapshot.
export async function getVesselServicePlan(vesselId: string): Promise<SlashServicePlan> {
  const raw = await starlinkFetch<SlashVesselServicePlanResponse>(
    `/vessels/${encodeURIComponent(vesselId)}/service-plan`,
    { revalidateSeconds: 60 }
  );
  const res = validateSlashResponse(slashVesselServicePlanResponseSchema, raw, "GET vessel service-plan");
  return res.servicePlan;
}
