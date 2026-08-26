import "server-only";
import { listUserTerminalAlerts } from "@/lib/starlink/alerts";
import { listTerminals } from "./service";
import type { SlashAlertEpisode } from "@/lib/starlink/types";

// App-level join: GET /alerts/user-terminals returns every alert for the
// whole API key's account (no vessel/customer filter on the endpoint
// itself), so customer-scoping happens here by matching each episode's
// userTerminalId against that customer's own terminal IDs (TerminalRecord.id
// *is* userTerminalId for live-sourced records — see liveProvider.ts).
//
// GET /alerts/routers is NOT CONFIRMED — this only covers user-terminal
// alerts, the one confirmed alert endpoint.
export type EnrichedAlert = SlashAlertEpisode & {
  active: boolean;
  terminalLabel: string | null;
  customerName: string | null;
  customerId: string | null;
};

export async function listTerminalAlerts(filters?: { customerId?: string }): Promise<EnrichedAlert[]> {
  const terminals = await listTerminals(filters?.customerId ? { customerId: filters.customerId } : undefined);
  const byId = new Map(terminals.map((t) => [t.id, t]));

  let episodes: SlashAlertEpisode[] = [];
  try {
    episodes = await listUserTerminalAlerts();
  } catch (err) {
    console.error("[alerts] failed to load /alerts/user-terminals:", err instanceof Error ? err.message : err);
    return [];
  }

  const scoped = filters?.customerId
    ? episodes.filter((e) => e.userTerminalId && byId.has(e.userTerminalId))
    : episodes;

  return scoped.map((e) => {
    const terminal = e.userTerminalId ? byId.get(e.userTerminalId) : undefined;
    return {
      ...e,
      active: !e.endedAt,
      terminalLabel: terminal?.identification.serialNumber ?? e.userTerminalId ?? null,
      customerName: terminal?.activation.assignedCustomerName ?? null,
      customerId: terminal?.activation.assignedCustomerId ?? null,
    };
  });
}
