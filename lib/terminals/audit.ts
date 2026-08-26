import "server-only";
import { connectDB } from "@/lib/db/connect";
import { ActivityLog } from "@/models/ActivityLog";
import "@/models/User"; // registers the User model for the .populate("actor") call below
import type { TerminalAuditEntry } from "./types";

// Real, app-level audit trail for a terminal (§32) — sourced from
// ActivityLog (written by lib/actions/terminals.ts on every remote
// command), NOT from the SLASH API, which has no audit-log endpoint.
// Separate from TerminalRecord.auditHistory, which mockProvider.ts fills
// with illustrative canned entries for terminals that have no real activity
// yet.
export async function getTerminalAuditTrail(terminalId: string): Promise<TerminalAuditEntry[]> {
  await connectDB();
  const entries = await ActivityLog.find({ "meta.terminalId": terminalId })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("actor", "name")
    .lean();

  return entries.map((e) => {
    const actor = e.actor as unknown as { name?: string } | null;
    const meta = (e.meta ?? {}) as Record<string, unknown>;
    const label = typeof meta.label === "string" ? meta.label : e.action.replace(/_/g, " ");
    return {
      id: e._id.toString(),
      action: label,
      actor: actor?.name ?? "System",
      timestamp: (e.createdAt as Date | undefined)?.toISOString() ?? new Date().toISOString(),
      details: e.action,
    };
  });
}
