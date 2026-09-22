import "server-only";
import type { ConnectionState, OnlineStatus } from "./types";

// Single definition of "online" for the whole app.
//
// Previously a terminal was shown ONLINE whenever its service line was
// active — i.e. whenever it was *subscribed*, even if the dish had been
// unplugged for weeks. The real signal is telemetry freshness: SLASH's
// /telemetry/vessels/latest reports when each device last sent telemetry
// (lastSeenAt). A device is ONLINE when that is recent, OFFLINE when it is
// older (or the device has never reported), and UNKNOWN only when the
// telemetry call itself failed, so an API outage is never displayed as
// "all devices offline".

const DEFAULT_THRESHOLD_MINUTES = 15;

export function onlineThresholdMinutes(): number {
  const n = Number(process.env.TERMINAL_ONLINE_THRESHOLD_MINUTES);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_THRESHOLD_MINUTES;
}

function relative(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export function deriveConnectivity(params: {
  /** false when the telemetry request failed (API error/timeout). */
  telemetryAvailable: boolean;
  lastSeenAt: string | null | undefined;
  now?: number;
}): { onlineStatus: OnlineStatus; connectionState: ConnectionState; statusReason: string } {
  if (!params.telemetryAvailable) {
    return {
      onlineStatus: "UNKNOWN",
      connectionState: "UNKNOWN",
      statusReason: "Live telemetry is temporarily unavailable from the provider.",
    };
  }

  const seen = params.lastSeenAt ? new Date(params.lastSeenAt).getTime() : NaN;
  if (!Number.isFinite(seen)) {
    return {
      onlineStatus: "OFFLINE",
      connectionState: "DISCONNECTED",
      statusReason: "No telemetry received from this terminal in the last 7 days.",
    };
  }

  const age = (params.now ?? Date.now()) - seen;
  if (age <= onlineThresholdMinutes() * 60_000) {
    return { onlineStatus: "ONLINE", connectionState: "CONNECTED", statusReason: `Last telemetry ${relative(Math.max(0, age))}.` };
  }
  return { onlineStatus: "OFFLINE", connectionState: "DISCONNECTED", statusReason: `Last seen ${relative(age)}.` };
}
