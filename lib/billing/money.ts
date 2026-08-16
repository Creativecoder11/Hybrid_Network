/**
 * Decimal-safe currency helpers. All money math runs in integer minor units
 * (cents) so repeated additions/percentages can't drift the way raw
 * floating-point multiplication does (e.g. 0.1 + 0.2 !== 0.3).
 */

export function toCents(amount: number): number {
  const value = Number.isFinite(amount) ? amount : 0;
  return Math.round((value + Number.EPSILON) * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

/** Rounds a currency amount to 2 decimal places via integer-cent arithmetic. */
export function roundCurrency(amount: number): number {
  return fromCents(toCents(amount));
}
