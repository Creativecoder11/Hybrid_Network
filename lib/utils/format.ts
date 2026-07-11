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
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
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
