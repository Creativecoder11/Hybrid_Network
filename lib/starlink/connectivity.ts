import "server-only";
import { starlinkFetch } from "./client";
import { validateSlashResponse } from "./validate";
import { slashVesselConnectivityStatusResponseSchema } from "./schemas";
import type { SlashVesselConnectivityStatusResponse } from "./types";

// /connectivity/history is NOT CONFIRMED. /connectivity/status is real and
// typed, but connectivityStats has been empty for every observed call — its
// populated shape (latency/uptime/signal fields etc.) is genuinely unknown,
// not just unimplemented. Callers should treat an empty array as "no
// connectivity telemetry available," not as "0% uptime."
export async function getVesselConnectivityStatus(
  vesselId: string
): Promise<SlashVesselConnectivityStatusResponse> {
  const raw = await starlinkFetch<SlashVesselConnectivityStatusResponse>(
    `/vessels/${encodeURIComponent(vesselId)}/connectivity/status`
  );
  return validateSlashResponse(
    slashVesselConnectivityStatusResponseSchema,
    raw,
    "GET vessel connectivity/status"
  );
}
