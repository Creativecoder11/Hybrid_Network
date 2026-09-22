import "server-only";
import { starlinkFetch } from "./client";
import { validateSlashResponse } from "./validate";
import { slashVesselListResponseSchema, slashVesselSchema } from "./schemas";
import type { SlashVessel, SlashVesselListResponse } from "./types";

// Vessel list changes rarely (provisioning-time data), so a short cache
// window is safe and cuts down on repeated /vessels calls across a
// dashboard render — relevant given this endpoint's request rate is
// constrained (see docs/slash-api-integration-plan.md).
const VESSEL_LIST_REVALIDATE_SECONDS = 30;

export async function listVessels(): Promise<SlashVessel[]> {
  const limit = 100;
  let page = 0;
  const all: SlashVessel[] = [];

  for (;;) {
    // includeInactive: the API hides vessels whose service line is inactive
    // unless asked — without it a suspended customer's terminal would just
    // vanish from the fleet instead of showing as inactive.
    const raw = await starlinkFetch<SlashVesselListResponse>("/vessels", {
      query: { page, limit, includeInactive: true },
      revalidateSeconds: VESSEL_LIST_REVALIDATE_SECONDS,
    });
    const res = validateSlashResponse(slashVesselListResponseSchema, raw, "GET /vessels");
    all.push(...res.vessels);
    if (all.length >= res.totalCount || res.vessels.length === 0) break;
    page += 1;
  }

  return all;
}

export async function getVessel(vesselId: string): Promise<SlashVessel> {
  const raw = await starlinkFetch<SlashVessel>(`/vessels/${encodeURIComponent(vesselId)}`, {
    revalidateSeconds: VESSEL_LIST_REVALIDATE_SECONDS,
  });
  return validateSlashResponse(slashVesselSchema, raw, `GET /vessels/${vesselId}`);
}
