import "server-only";
import { connectDB } from "@/lib/db/connect";
import { TerminalState } from "@/models/TerminalState";
import { mockListTerminals, mockGetTerminal } from "./mockProvider";
import { liveListTerminals, liveGetTerminal } from "./liveProvider";
import { rebootUserTerminal } from "@/lib/starlink/passthrough";
import { friendlyStarlinkErrorMessage } from "@/lib/starlink/client";
import type { TerminalRecord, TerminalListFilters, RemoteCommandType } from "./types";

// Public API for the rest of the app. Everything above this file (Server
// Actions, pages, components) only ever imports from here. Customers linked
// to a real Starlink vessel (User.starlinkVesselId) are served by
// liveProvider; everyone else keeps using the fabricated mockProvider data.
//
// Of the request's remote-command list, only REBOOT maps to a confirmed
// real SLASH passthrough action (reboot_user_terminal) — see
// docs/slash-api-integration-plan.md. For terminals sourced from the live
// provider (record.sourceVesselId set), REBOOT calls that real action; every
// other command, and REBOOT for mock terminals, stays local-only against
// TerminalState (no confirmed endpoint exists for them).

async function applyOverrides(records: TerminalRecord[]): Promise<TerminalRecord[]> {
  if (records.length === 0) return records;
  await connectDB();
  const states = await TerminalState.find({ terminalId: { $in: records.map((r) => r.id) } }).lean();
  const stateMap = new Map(states.map((s) => [s.terminalId, s]));

  return records.map((r) => {
    const state = stateMap.get(r.id);
    if (!state) return r;
    const next: TerminalRecord = { ...r };
    if (state.statusOverride) next.status = state.statusOverride;
    if (state.firmwareUpdating) {
      next.health = { ...next.health, firmwareStatus: "UPDATING" };
    }
    return next;
  });
}

export async function listTerminals(filters?: TerminalListFilters): Promise<TerminalRecord[]> {
  const [liveRecords, mockRecords] = await Promise.all([
    liveListTerminals(filters),
    mockListTerminals(filters),
  ]);
  return applyOverrides([...liveRecords, ...mockRecords]);
}

export async function getTerminal(id: string): Promise<TerminalRecord | null> {
  const record = (await liveGetTerminal(id)) ?? (await mockGetTerminal(id));
  if (!record) return null;
  const [withOverrides] = await applyOverrides([record]);
  return withOverrides;
}

const COMMAND_LABELS: Record<RemoteCommandType, string> = {
  REBOOT: "Reboot terminal",
  REFRESH_SERVICE: "Refresh service",
  SUSPEND: "Suspend service",
  REACTIVATE: "Reactivate service",
  UPDATE_FIRMWARE: "Update firmware",
  REQUEST_DIAGNOSTICS: "Request diagnostics",
};

export function commandLabel(command: RemoteCommandType): string {
  return COMMAND_LABELS[command];
}

export async function sendTerminalCommand(
  id: string,
  command: RemoteCommandType,
  actorId: string
): Promise<TerminalRecord> {
  await connectDB();
  const existing = await getTerminal(id);
  if (!existing) throw new Error("Terminal not found");

  let realResult: "SENT" | "SKIPPED" = "SKIPPED";
  if (command === "REBOOT" && existing.sourceVesselId) {
    try {
      await rebootUserTerminal({ vesselId: existing.sourceVesselId, deviceId: existing.id });
      realResult = "SENT";
    } catch (err) {
      throw new Error(friendlyStarlinkErrorMessage(err));
    }
  }

  const update: Record<string, unknown> = {
    lastCommandAction: command,
    lastCommandAt: new Date(),
    lastCommandBy: actorId,
    ...(command === "REBOOT" ? { lastCommandTarget: realResult } : {}),
  };

  if (command === "SUSPEND") update.statusOverride = "SUSPENDED";
  if (command === "REACTIVATE") update.statusOverride = existing.activation.assignedCustomerId ? "ACTIVE" : null;
  if (command === "UPDATE_FIRMWARE") update.firmwareUpdating = true;
  if (command === "REQUEST_DIAGNOSTICS") update.lastDiagnosticsRequestedAt = new Date();

  await TerminalState.findOneAndUpdate({ terminalId: id }, { $set: update }, { upsert: true });

  const updated = await getTerminal(id);
  if (!updated) throw new Error("Terminal not found after command");
  return updated;
}
