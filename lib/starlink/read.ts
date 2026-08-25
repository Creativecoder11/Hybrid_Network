import "server-only";
import { starlinkFetch } from "./client";
import type {
  SlashVessel,
  SlashVesselListResponse,
  SlashVesselDataUsageResponse,
  SlashVesselServicePlanResponse,
  SlashVesselLocationResponse,
  SlashVesselLocationHistoryResponse,
  SlashVesselConnectivityStatusResponse,
  SlashUserTerminalAlertsResponse,
  SlashAlertEpisode,
} from "./types";

export async function listVessels(): Promise<SlashVessel[]> {
  const limit = 100;
  let page = 0;
  const all: SlashVessel[] = [];

  for (;;) {
    const res = await starlinkFetch<SlashVesselListResponse>("/vessels", { query: { page, limit } });
    all.push(...res.vessels);
    if (all.length >= res.totalCount || res.vessels.length === 0) break;
    page += 1;
  }

  return all;
}

export async function getVessel(vesselId: string): Promise<SlashVessel> {
  return starlinkFetch<SlashVessel>(`/vessels/${encodeURIComponent(vesselId)}`);
}

export async function getVesselDataUsage(vesselId: string) {
  const res = await starlinkFetch<SlashVesselDataUsageResponse>(
    `/vessels/${encodeURIComponent(vesselId)}/data-usage/current`
  );
  return res.dataUsage;
}

export async function getVesselServicePlan(vesselId: string) {
  const res = await starlinkFetch<SlashVesselServicePlanResponse>(
    `/vessels/${encodeURIComponent(vesselId)}/service-plan`
  );
  return res.servicePlan;
}

export async function getVesselLocation(vesselId: string) {
  const res = await starlinkFetch<SlashVesselLocationResponse>(
    `/vessels/${encodeURIComponent(vesselId)}/location/current`
  );
  return res.location;
}

export async function getVesselLocationHistory(vesselId: string) {
  const res = await starlinkFetch<SlashVesselLocationHistoryResponse>(
    `/vessels/${encodeURIComponent(vesselId)}/location/history`
  );
  return res.historyPoints ?? [];
}

export async function getVesselConnectivityStatus(vesselId: string) {
  return starlinkFetch<SlashVesselConnectivityStatusResponse>(
    `/vessels/${encodeURIComponent(vesselId)}/connectivity/status`
  );
}

export async function listUserTerminalAlerts(): Promise<SlashAlertEpisode[]> {
  const res = await starlinkFetch<SlashUserTerminalAlertsResponse>("/alerts/user-terminals", {
    query: { pageSize: 200 },
  });
  return res.data ?? [];
}
