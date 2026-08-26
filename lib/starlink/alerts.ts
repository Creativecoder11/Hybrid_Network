import "server-only";
import { starlinkFetch } from "./client";
import { validateSlashResponse } from "./validate";
import { slashUserTerminalAlertsResponseSchema } from "./schemas";
import type { SlashAlertEpisode, SlashUserTerminalAlertsResponse } from "./types";

// GET /alerts/routers is NOT CONFIRMED — no function for it exists here.
// Router alerts should render as a disabled "not supported by current API"
// state rather than calling a guessed endpoint.
export async function listUserTerminalAlerts(): Promise<SlashAlertEpisode[]> {
  const raw = await starlinkFetch<SlashUserTerminalAlertsResponse>("/alerts/user-terminals", {
    query: { pageSize: 200 },
  });
  const res = validateSlashResponse(slashUserTerminalAlertsResponseSchema, raw, "GET /alerts/user-terminals");
  return res.data ?? [];
}
