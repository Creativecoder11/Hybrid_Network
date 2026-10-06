import { test } from "node:test";
import assert from "node:assert/strict";
import {
  billingDateInMonth,
  issueDateForCycle,
  nextBillingDateOnOrAfter,
  parseDateOnly,
  periodMonthOf,
} from "@/lib/billing/recurringSchedule";

// Recurring invoice date math: monthly cycles on a fixed billing day,
// clamped to month end. Pure functions, no database.

const iso = (d: Date) => d.toISOString().slice(0, 10);

test("parses date-only strings and rejects invalid dates", () => {
  assert.equal(iso(parseDateOnly("2026-10-06")!), "2026-10-06");
  assert.equal(parseDateOnly("2026-02-30"), null);
  assert.equal(parseDateOnly("06/10/2026"), null);
});

test("cycles fall on the same day each month", () => {
  const schedule = { anchorDate: parseDateOnly("2026-10-15")!, anchorCycle: 0, billingDay: 15 };
  assert.equal(iso(issueDateForCycle(schedule, 0)), "2026-10-15");
  assert.equal(iso(issueDateForCycle(schedule, 1)), "2026-11-15");
  assert.equal(iso(issueDateForCycle(schedule, 3)), "2027-01-15");
});

test("a 36-month term ends 35 months after the first invoice", () => {
  const schedule = { anchorDate: parseDateOnly("2026-10-06")!, anchorCycle: 0, billingDay: 6 };
  assert.equal(iso(issueDateForCycle(schedule, 35)), "2029-09-06");
});

test("billing day 31 clamps to short months without drifting", () => {
  const schedule = { anchorDate: parseDateOnly("2026-01-31")!, anchorCycle: 0, billingDay: 31 };
  assert.equal(iso(issueDateForCycle(schedule, 1)), "2026-02-28");
  assert.equal(iso(issueDateForCycle(schedule, 2)), "2026-03-31");
  assert.equal(iso(issueDateForCycle(schedule, 3)), "2026-04-30");
  assert.equal(iso(billingDateInMonth(parseDateOnly("2028-01-31")!, 1, 31)), "2028-02-29");
});

test("a resumed schedule continues from its new anchor", () => {
  // 4 invoices issued, paused, resumed so cycle 4 issues on 2027-05-10.
  const schedule = { anchorDate: parseDateOnly("2027-05-10")!, anchorCycle: 4, billingDay: 10 };
  assert.equal(iso(issueDateForCycle(schedule, 4)), "2027-05-10");
  assert.equal(iso(issueDateForCycle(schedule, 11)), "2027-12-10");
});

test("next billing date is today when today is the billing day, else the next one", () => {
  assert.equal(iso(nextBillingDateOnOrAfter(new Date("2026-10-06T15:00:00Z"), 6)), "2026-10-06");
  assert.equal(iso(nextBillingDateOnOrAfter(new Date("2026-10-07T00:00:00Z"), 6)), "2026-11-06");
  assert.equal(iso(nextBillingDateOnOrAfter(new Date("2026-02-10T00:00:00Z"), 31)), "2026-02-28");
});

test("period month comes from the issue date", () => {
  assert.equal(periodMonthOf(parseDateOnly("2026-12-01")!), "202612");
});
