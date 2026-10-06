import "server-only";
import { starlinkFetch } from "./client";
import { validateSlashResponse } from "./validate";
import { slashVesselLatestTelemetryResponseSchema } from "./schemas";
import type { SlashVesselLatestTelemetry, SlashVesselLatestTelemetryResponse } from "./types";

// GET /telemetry/vessels/latest — the latest telemetry row for every
// (vessel, device) pair in the tenant: signal quality, down/uplink
// throughput, latency, drop rate, obstruction, uptime, running software
// (firmware) version, position, and staleness. One paginated call covers the
// whole fleet, so the device list doesn't need a request per terminal.
//
// timeRangeHours only controls the `stale` flag (max 168); silent devices are
// still returned. Online/offline is derived from lastSeenAt in
// lib/terminals/status.ts rather than from `stale`, because a device that
// last reported 20 hours ago is not stale within a 24-hour window but is
// clearly not online now.

const PAGE_SIZE = 1000;
// Telemetry is ingested continuously. The portal device pages refresh every
// 6 s (LIVE_DEVICE_POLL_INTERVAL_MS); the cache matches so each refresh can
// see new data, and because it is shared, SLASH gets at most ~10 calls a
// minute per query however many people are watching.
const TELEMETRY_REVALIDATE_SECONDS = 6;

export async function listLatestTelemetry(params?: {
  vesselId?: string;
  timeRangeHours?: number;
}): Promise<SlashVesselLatestTelemetry[]> {
  const all: SlashVesselLatestTelemetry[] = [];
  let pageIndex = 0;

  for (;;) {
    const raw = await starlinkFetch<SlashVesselLatestTelemetryResponse>("/telemetry/vessels/latest", {
      query: {
        vesselId: params?.vesselId,
        timeRangeHours: params?.timeRangeHours ?? 24,
        includeAlerts: false,
        pageIndex,
        pageSize: PAGE_SIZE,
      },
      revalidateSeconds: TELEMETRY_REVALIDATE_SECONDS,
    });
    const res = validateSlashResponse(slashVesselLatestTelemetryResponseSchema, raw, "GET /telemetry/vessels/latest");
    const rows = res.data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE || all.length >= res.totalCount) break;
    pageIndex += 1;
  }

  return all;
}
