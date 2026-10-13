const APP_TIMEZONE = "Asia/Dhaka";

export function bytesToGB(bytes: number | null | undefined): number {
  if (!bytes) return 0;
  return bytes / 1_000_000_000;
}

export function formatGB(bytes: number | null | undefined, decimals = 2): string {
  return `${bytesToGB(bytes).toFixed(decimals)} GB`;
}

export function formatBytesAuto(bytes: number | null | undefined): string {
  if (!bytes) return "0 MB";
  const gb = bytesToGB(bytes);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / 1_000_000;
  return `${mb.toFixed(2)} MB`;
}

export function formatCurrency(
  amount: number | null | undefined,
  currency = "USD"
): string {
  const value = amount ?? 0;
  try {
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
    return formatted.replace(/^(-?)[A-Za-z]+(?=\$)/, "$1");
  } catch {
    const sign = value < 0 ? "-$" : "$";
    return `${sign}${Math.abs(value).toFixed(2)}`;
  }
}

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "--";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "--";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: APP_TIMEZONE,
  }).format(d);
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "--";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "--";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  }).format(d);
}

export function formatPeriodMonth(periodMonth: string | null | undefined): string {
  if (!periodMonth || periodMonth.length !== 6) return "--";
  const year = periodMonth.slice(0, 4);
  const month = periodMonth.slice(4, 6);
  const d = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: APP_TIMEZONE,
  }).format(d);
}

export function daysUntil(date: Date | string | null | undefined): number {
  if (!date) return 0;
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function displayOrDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "--";
  return String(value);
}

/**
 * Formats raw Starlink service plan names and SKU product reference IDs
 * (e.g. "nl-enterprise-local-priority-terminal-access-fee-eur") into clean,
 * professional display names (e.g. "Starlink Enterprise Local Priority").
 */
export function formatServicePlanName(rawPlan?: string | null, fallback = ""): string {
  if (!rawPlan || !rawPlan.trim()) return fallback;

  const trimmed = rawPlan.trim();

  // If already a nice human-readable string without dash-slugs, return as is
  if (!trimmed.includes("-") && !trimmed.includes("_")) {
    return trimmed;
  }

  // Known specific mappings
  const knownMappings: Record<string, string> = {
    "nl-enterprise-local-priority-terminal-access-fee-eur": "Starlink Enterprise Local Priority",
    "enterprise-local-priority-terminal-access-fee": "Starlink Enterprise Local Priority",
    "mobile-priority-50gb": "Starlink Mobile Priority 50GB",
    "mobile-priority-1tb": "Starlink Mobile Priority 1TB",
    "mobile-priority-5tb": "Starlink Mobile Priority 5TB",
    "priority-50gb": "Starlink Priority 50GB",
    "priority-1tb": "Starlink Priority 1TB",
    "priority-2tb": "Starlink Priority 2TB",
    "standard-unlimited": "Starlink Standard Unlimited",
  };

  const lower = trimmed.toLowerCase();
  if (knownMappings[lower]) {
    return knownMappings[lower];
  }

  // Generic heuristic cleanup for Starlink SKUs:
  // e.g. "nl-enterprise-local-priority-terminal-access-fee-eur"
  let cleaned = lower
    .replace(/^[a-z]{2}-/, "") // strip region prefix e.g. nl-, us-, au-
    .replace(/-(eur|usd|myr|aud|gbp|cad|sgd|nzd)$/, "") // strip currency suffix
    .replace(/-terminal-access-fee$/, "") // strip terminal-access-fee suffix
    .replace(/-access-fee$/, "")
    .replace(/[-_]+/g, " ")
    .trim();

  // Title-case each word and preserve units (GB, TB, Mbps)
  cleaned = cleaned
    .split(" ")
    .map((word) => {
      if (/^\d+(gb|tb|mbps)$/i.test(word)) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");

  if (!cleaned.toLowerCase().includes("starlink")) {
    cleaned = `Starlink ${cleaned}`;
  }

  return cleaned || trimmed;
}

