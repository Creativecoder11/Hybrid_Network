"use server";

import { getAuthorizedUser } from "@/lib/auth/dal";
import { getTerminal } from "@/lib/terminals/service";
import { getVesselLocationHistory } from "@/lib/starlink/locations";
import { friendlyStarlinkErrorMessage } from "@/lib/starlink/client";
import { getPortalContextForRequest, canAccessAccount } from "@/lib/accounts/access";
import type { LocationHistoryPoint } from "@/lib/terminals/types";

const ADMIN_ROLES = ["SUPER_ADMIN", "SUB_ADMIN"] as const;

// Location history for one terminal (Tracking page). Customers are checked
// against (1) the Super Admin tracking switch and (2) ownership of the
// terminal's Customer Account — both on the server, so a hand-crafted request
// for another account's terminal, or with tracking disabled, is refused.
export async function getTerminalLocationHistoryAction(
  terminalId: string,
  startDate?: string,
  endDate?: string
): Promise<{ points: LocationHistoryPoint[] } | { error: string }> {
  const user = await getAuthorizedUser();
  if (!user) return { error: "Not authorized." };
  if (typeof terminalId !== "string" || !terminalId) return { error: "Terminal not found." };

  const isAdmin = (ADMIN_ROLES as readonly string[]).includes(user.role);
  if (!isAdmin) {
    const ctx = await getPortalContextForRequest();
    if (!ctx) return { error: "Not authorized." };
    if (!ctx.features.tracking) return { error: "Tracking has been disabled by your administrator." };
    const terminal = await getTerminal(terminalId);
    if (!terminal || !canAccessAccount(ctx, terminal.activation.assignedAccountId)) {
      return { error: "Terminal not found." };
    }
    return loadHistory(terminal.sourceVesselId, terminal.locationHistory, startDate, endDate);
  }

  const terminal = await getTerminal(terminalId);
  if (!terminal) return { error: "Terminal not found." };
  return loadHistory(terminal.sourceVesselId, terminal.locationHistory, startDate, endDate);
}

async function loadHistory(
  vesselId: string | undefined,
  fallback: LocationHistoryPoint[],
  startDate?: string,
  endDate?: string
): Promise<{ points: LocationHistoryPoint[] } | { error: string }> {
  if (!vesselId) return { points: fallback }; // demo terminal

  try {
    const raw = await getVesselLocationHistory(vesselId, { startDate, endDate });
    const points: LocationHistoryPoint[] = raw
      .filter((p) => !(p.latitude === 0 && p.longitude === 0))
      .map((p, i) => ({
        id: `hist-${i}`,
        latitude: p.latitude,
        longitude: p.longitude,
        altitudeMeters: 0,
        accuracyMeters: 0,
        timestamp: p.timestamp,
      }));
    return { points };
  } catch (err) {
    return { error: friendlyStarlinkErrorMessage(err) };
  }
}
