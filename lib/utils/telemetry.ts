// Display helpers for device telemetry. A null value means the API did not
// provide the metric, and is shown as "Not available" — never as 0.

export const NOT_AVAILABLE = "Not available";

export function fmtPct(v: number | null | undefined, decimals = 0): string {
  return typeof v === "number" ? `${v.toFixed(decimals)}%` : NOT_AVAILABLE;
}

export function fmtMbps(v: number | null | undefined): string {
  if (typeof v !== "number") return NOT_AVAILABLE;
  if (v === 0) return "0.0 dB";
  if (v < 0.01 && v > 0) return "< 0.01 dB";
  if (v < 1) return `${v.toFixed(2)} dB`;
  if (v < 10) return `${v.toFixed(1)} dB`;
  return `${v.toFixed(0)} dB`;
}

export function fmtMs(v: number | null | undefined): string {
  return typeof v === "number" ? `${Math.round(v)} ms` : NOT_AVAILABLE;
}

export function fmtDbm(v: number | null | undefined): string {
  return typeof v === "number" ? `${v} dBm` : NOT_AVAILABLE;
}

/** Seconds since boot -> "3d 4h" / "5h 12m" / "8m". */
export function fmtUptime(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || seconds < 0) return NOT_AVAILABLE;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function fmtText(v: string | null | undefined): string {
  return v && v.trim() ? v : NOT_AVAILABLE;
}
