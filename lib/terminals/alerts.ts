import "server-only";
import { listUserTerminalAlerts } from "@/lib/starlink/alerts";
import { describeStarlinkError } from "@/lib/starlink/client";
import { listTerminals } from "./service";
import type { SlashAlertEpisode } from "@/lib/starlink/types";
import type { TerminalListFilters } from "./types";

// Normalized alert episodes. GET /alerts/user-terminals returns every alert
// for the whole SLASH tenant, so customer scoping happens here: an episode is
// kept only when its deviceId is one of the caller's own terminals (a
// TerminalRecord's id IS the SLASH userTerminalId / deviceId).
export type EnrichedAlert = {
  id: string;
  deviceId: string | null;
  alertName: string;
  description: string;
  active: boolean;
  firstSeen: string | null;
  lastSeen: string | null;
  sampleCount: number | null;
  terminalLabel: string | null;
  customerName: string | null;
  customerId: string | null;
  accountId: string | null;
  accountNumber: string | null;
};

function humanize(name: string | undefined): string {
  if (!name) return "Alert";
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function listTerminalAlerts(filters?: Pick<TerminalListFilters, "customerId" | "accountIds">): Promise<EnrichedAlert[]> {
  const scoped = Boolean(filters?.customerId || filters?.accountIds);
  const terminals = await listTerminals(scoped ? filters : undefined);
  if (scoped && terminals.length === 0) return [];
  const byId = new Map(terminals.map((t) => [t.id, t]));

  let episodes: SlashAlertEpisode[] = [];
  try {
    episodes = await listUserTerminalAlerts();
  } catch (err) {
    console.error(`[alerts] failed to load /alerts/user-terminals: ${describeStarlinkError(err)}`);
    return [];
  }

  const visible = scoped ? episodes.filter((e) => e.deviceId && byId.has(e.deviceId)) : episodes;

  return visible
    .map((e, i) => {
      const terminal = e.deviceId ? byId.get(e.deviceId) : undefined;
      return {
        id: `${e.deviceId ?? "unknown"}-${e.alertId ?? i}-${e.firstSeen ?? i}`,
        deviceId: e.deviceId ?? null,
        alertName: humanize(e.alertName),
        description: e.alertDescription ?? "",
        active: Boolean(e.active),
        firstSeen: e.firstSeen ?? null,
        lastSeen: e.lastSeen ?? e.timestamp ?? null,
        sampleCount: typeof e.sampleCount === "number" ? e.sampleCount : null,
        terminalLabel: terminal?.activation.displayName ?? terminal?.identification.serialNumber ?? e.deviceId ?? null,
        customerName: terminal?.activation.assignedCustomerName ?? null,
        customerId: terminal?.activation.assignedCustomerId ?? null,
        accountId: terminal?.activation.assignedAccountId ?? null,
        accountNumber: terminal?.activation.assignedAccountNumber ?? null,
      };
    })
    .sort((a, b) => (b.lastSeen ?? "").localeCompare(a.lastSeen ?? ""));
}
