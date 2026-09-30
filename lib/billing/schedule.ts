// Calendar-month schedule for recurring invoices. All dates are UTC midnight
// (date-only values), so a schedule never shifts with the server's timezone.
//
// Occurrences are anchored to the start date's day of month and clamped to
// shorter months: a schedule starting on 31 Jan issues on 28/29 Feb, 31 Mar,
// 30 Apr... — never "30 days later", which drifts.

export const MIN_RECURRING_MONTHS = 1;
export const MAX_RECURRING_MONTHS = 36;

const DAY_MS = 24 * 60 * 60 * 1000;

function daysInMonthUtc(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** "YYYY-MM-DD" -> UTC midnight Date, or null if not a real calendar date. */
export function parseDateOnly(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonthUtc(year, month - 1)) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

export function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Issue date of occurrence `index` (0 = the start date itself). */
export function occurrenceDate(start: Date, index: number): Date {
  const anchorDay = start.getUTCDate();
  const monthIndex = start.getUTCMonth() + index;
  const year = start.getUTCFullYear() + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  return new Date(Date.UTC(year, month, Math.min(anchorDay, daysInMonthUtc(year, month))));
}

/** Billing month ("YYYYMM") an occurrence is invoiced for. */
export function periodMonthOf(date: Date): string {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type ScheduleSummary = {
  firstInvoiceDate: Date;
  lastInvoiceDate: Date;
  /** Last day covered: the day before the occurrence after the last one. */
  endDate: Date;
  invoiceDates: Date[];
};

export function scheduleSummary(start: Date, months: number): ScheduleSummary {
  const invoiceDates = Array.from({ length: months }, (_, i) => occurrenceDate(start, i));
  return {
    firstInvoiceDate: invoiceDates[0],
    lastInvoiceDate: invoiceDates[invoiceDates.length - 1],
    endDate: addDaysUtc(occurrenceDate(start, months), -1),
    invoiceDates,
  };
}
