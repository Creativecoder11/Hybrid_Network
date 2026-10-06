// Date math for recurring invoices. Pure (no DB) so it can be unit tested.
// All dates are UTC midnights; a schedule bills on `billingDay` each month,
// clamped to the month's last day (31st → 28/29 Feb, 30 Apr, ...).

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** The billing date in the month `monthOffset` months after `from`'s month. */
export function billingDateInMonth(from: Date, monthOffset: number, billingDay: number): Date {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth() + monthOffset;
  const normalized = new Date(Date.UTC(y, m, 1));
  const day = Math.min(billingDay, daysInMonth(normalized.getUTCFullYear(), normalized.getUTCMonth()));
  return new Date(Date.UTC(normalized.getUTCFullYear(), normalized.getUTCMonth(), day));
}

/** Issue date of cycle `cycle` (0-based) for a schedule anchored at (anchorDate, anchorCycle). */
export function issueDateForCycle(
  schedule: { anchorDate: Date; anchorCycle: number; billingDay: number },
  cycle: number
): Date {
  return billingDateInMonth(schedule.anchorDate, cycle - schedule.anchorCycle, schedule.billingDay);
}

/** First billing date (UTC midnight) on or after `date`. */
export function nextBillingDateOnOrAfter(date: Date, billingDay: number): Date {
  const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const sameMonth = billingDateInMonth(dayStart, 0, billingDay);
  return sameMonth.getTime() >= dayStart.getTime() ? sameMonth : billingDateInMonth(dayStart, 1, billingDay);
}

/** Parses "YYYY-MM-DD" to a UTC midnight, or null. */
export function parseDateOnly(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCMonth() === Number(m[2]) - 1 ? d : null;
}

export function periodMonthOf(date: Date): string {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
