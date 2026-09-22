import "server-only";
import { connectDB } from "@/lib/db/connect";
import { TerminalState } from "@/models/TerminalState";
import { CustomerAccount } from "@/models/CustomerAccount";
import { mockListTerminals, mockGetTerminal } from "./mockProvider";
import { liveListTerminals, liveListTerminalsDetailed, liveGetTerminal } from "./liveProvider";
import { rebootUserTerminal, SlashWriteError } from "@/lib/starlink/passthrough";
import { friendlyStarlinkErrorMessage, StarlinkApiError } from "@/lib/starlink/client";
import type { TerminalRecord, TerminalListFilters, RemoteCommandType } from "./types";

// Public API for the rest of the app. Everything above this file (Server
// Actions, pages, components) only ever imports from here.
//
// Real devices come from the SLASH API (liveProvider). The demo generator
// (mockProvider) contributes nothing unless ENABLE_DEMO_TERMINALS=true, and
// never to account-scoped (customer portal) queries.
//
// Commands: REBOOT is the only remote command with a real SLASH passthrough
// action (reboot_user_terminal); it goes through the audited WRITE path that
// also emails Station Satcom. Other commands have no confirmed SLASH action,
// so they are refused for real devices rather than faked with a local status
// override, and remain simulation-only for demo devices.

async function applyDemoOverrides(records: TerminalRecord[]): Promise<TerminalRecord[]> {
  const demo = records.filter((r) => r.dataSource === "DEMO");
  if (demo.length === 0) return records;
  await connectDB();
  const states = await TerminalState.find({ terminalId: { $in: demo.map((r) => r.id) } }).lean();
  const stateMap = new Map(states.map((s) => [s.terminalId, s]));

  return records.map((r) => {
    const state = r.dataSource === "DEMO" ? stateMap.get(r.id) : undefined;
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
  const [liveRecords, demoRecords] = await Promise.all([liveListTerminals(filters), mockListTerminals(filters)]);
  return applyDemoOverrides([...liveRecords, ...demoRecords]);
}

/**
 * Devices for the customer portal: account-scoped, plus whether any of the
 * account's linked Starlink vessels could not be loaded (so the page can say
 * "unable to load" instead of wrongly showing "no devices").
 */
export async function listAccountTerminals(accountIds: string[]): Promise<{ terminals: TerminalRecord[]; unavailable: boolean }> {
  const { records, failedVesselIds } = await liveListTerminalsDetailed({ accountIds });
  return { terminals: records, unavailable: failedVesselIds.length > 0 };
}

export async function getTerminal(id: string): Promise<TerminalRecord | null> {
  const record = (await liveGetTerminal(id)) ?? (await mockGetTerminal(id));
  if (!record) return null;
  const [withOverrides] = await applyDemoOverrides([record]);
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
  actor: { id: string; name: string; email: string }
): Promise<TerminalRecord> {
  await connectDB();
  const existing = await getTerminal(id);
  if (!existing) throw new Error("Terminal not found");

  if (existing.dataSource === "SLASH") {
    if (command !== "REBOOT" || !existing.sourceVesselId) {
      throw new Error(`${commandLabel(command)} is not supported by the SLASH API for Starlink terminals.`);
    }
    const account = existing.activation.assignedAccountId
      ? await CustomerAccount.findById(existing.activation.assignedAccountId).select("slashAccountNumber").lean()
      : null;
    try {
      await rebootUserTerminal(
        { vesselId: existing.sourceVesselId, deviceId: existing.id },
        {
          operation: "Reboot user terminal",
          initiatedBy: actor,
          customerId: existing.activation.assignedCustomerId,
          customerName: existing.activation.assignedCustomerName,
          accountId: existing.activation.assignedAccountId,
          accountNumber: existing.activation.assignedAccountNumber,
          slashAccountNumber: account?.slashAccountNumber || null,
          serviceLineNumber: existing.activation.serviceLineNumber,
          deviceId: existing.id,
          kitSerialNumber: existing.identification.serialNumber,
          product: existing.planBilling.assignedPlan,
        }
      );
    } catch (err) {
      if (err instanceof StarlinkApiError) throw new Error(friendlyStarlinkErrorMessage(err));
      if (err instanceof SlashWriteError) throw new Error("The terminal provider did not accept the reboot request.");
      throw err;
    }
    await TerminalState.findOneAndUpdate(
      { terminalId: id },
      { $set: { lastCommandAction: command, lastCommandAt: new Date(), lastCommandBy: actor.id, lastCommandTarget: "SENT" } },
      { upsert: true }
    );
    return existing;
  }

  // Demo terminal: local simulation only.
  const update: Record<string, unknown> = {
    lastCommandAction: command,
    lastCommandAt: new Date(),
    lastCommandBy: actor.id,
    ...(command === "REBOOT" ? { lastCommandTarget: "SKIPPED" } : {}),
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
