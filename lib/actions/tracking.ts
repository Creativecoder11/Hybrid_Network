"use server";

import { getAuthorizedUser } from "@/lib/auth/dal";
import { getTerminal } from "@/lib/terminals/service";
import { getVesselLocationHistory } from "@/lib/starlink/locations";
import { friendlyStarlinkErrorMessage } from "@/lib/starlink/client";
import type { LocationHistoryPoint } from "@/lib/terminals/types";

const ADMIN_ROLES = ["SUPER_ADMIN", "SUB_ADMIN"] as const;

// Historical GPS (§11) — for live (Starlink-linked) terminals this calls the
// real location/history endpoint with a date range; date-range support
// itself isn't confirmed by anything in lib/starlink's verified surface, so
// this passes the range through best-effort and lets the API ignore it if
// unsupported, rather than fabricating a client-side date filter that would
// silently disagree with the API's own windowing.
export async function getTerminalLocationHistoryAction(
  terminalId: string,
  startDate?: string,
  endDate?: string
): Promise<{ points: LocationHistoryPoint[] } | { error: string }> {
  const user = await getAuthorizedUser();
  if (!user) return { error: "Not authorized." };

  const terminal = await getTerminal(terminalId);
  if (!terminal) return { error: "Terminal not found." };

  const isAdmin = (ADMIN_ROLES as readonly string[]).includes(user.role);
  if (!isAdmin && terminal.activation.assignedCustomerId !== user.id) {
    return { error: "Not authorized." };
  }

  if (!terminal.sourceVesselId) {
    // Mock terminal — no real date-range endpoint behind it.
    return { points: terminal.locationHistory };
  }

  try {
    const raw = await getVesselLocationHistory(terminal.sourceVesselId, { startDate, endDate });
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
