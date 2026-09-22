import "server-only";
import { starlinkFetch } from "./client";
import { validateSlashResponse } from "./validate";
import { slashUserTerminalAlertsResponseSchema } from "./schemas";
import type { SlashAlertEpisode, SlashUserTerminalAlertsResponse } from "./types";

// GET /alerts/user-terminals — alert episodes (default window: last 7 days)
// for the whole tenant; customer scoping happens in lib/terminals/alerts.ts by
// matching each episode's deviceId to the customer's own terminals.
// Router alerts are documented as "currently unpopulated upstream", so only
// user-terminal alerts are read.
const PAGE_SIZE = 1000;

export async function listUserTerminalAlerts(params?: { deviceId?: string }): Promise<SlashAlertEpisode[]> {
  const all: SlashAlertEpisode[] = [];
  for (let pageIndex = 0; pageIndex < 20; pageIndex++) {
    const raw = await starlinkFetch<SlashUserTerminalAlertsResponse>("/alerts/user-terminals", {
      query: { deviceId: params?.deviceId, pageIndex, pageSize: PAGE_SIZE },
      revalidateSeconds: 60,
    });
    const res = validateSlashResponse(slashUserTerminalAlertsResponseSchema, raw, "GET /alerts/user-terminals");
    const rows = res.data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE || all.length >= res.totalCount) break;
  }
  return all;
}
