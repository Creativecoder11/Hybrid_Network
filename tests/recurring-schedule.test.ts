import { test } from "node:test";
import assert from "node:assert/strict";
import {
  occurrenceDate,
  parseDateOnly,
  periodMonthOf,
  scheduleSummary,
  toDateOnlyString,
} from "@/lib/billing/schedule";

const d = (s: string) => parseDateOnly(s) as Date;
const iso = (x: Date) => toDateOnlyString(x);

test("12 months from 1 Oct 2026 ends 30 Sep 2027", () => {
  const s = scheduleSummary(d("2026-10-01"), 12);
  assert.equal(s.invoiceDates.length, 12);
  assert.equal(iso(s.firstInvoiceDate), "2026-10-01");
  assert.equal(iso(s.lastInvoiceDate), "2027-09-01");
  assert.equal(iso(s.endDate), "2027-09-30");
});

test("month-end start clamps to shorter months without drifting", () => {
  const start = d("2026-01-31");
  assert.deepEqual(
    [0, 1, 2, 3].map((i) => iso(occurrenceDate(start, i))),
    ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]
  );
});

test("leap years: 29 Feb only exists in leap years", () => {
  const start = d("2027-12-29");
  assert.equal(iso(occurrenceDate(start, 2)), "2028-02-29"); // 2028 is a leap year
  assert.equal(iso(occurrenceDate(d("2026-01-30"), 1)), "2026-02-28");
  assert.equal(parseDateOnly("2026-02-29"), null);
  assert.equal(iso(d("2028-02-29")), "2028-02-29");
});

test("36 months spans three years and year boundaries", () => {
  const s = scheduleSummary(d("2026-11-15"), 36);
  assert.equal(iso(s.lastInvoiceDate), "2029-10-15");
  assert.equal(iso(s.endDate), "2029-11-14");
  assert.equal(periodMonthOf(occurrenceDate(d("2026-11-15"), 2)), "202701");
});

test("single month schedule", () => {
  const s = scheduleSummary(d("2026-10-01"), 1);
  assert.equal(s.invoiceDates.length, 1);
  assert.equal(iso(s.endDate), "2026-10-31");
});

test("rejects malformed dates", () => {
  for (const bad of ["2026-13-01", "2026-04-31", "01/10/2026", "", "2026-1-1"]) {
    assert.equal(parseDateOnly(bad), null, bad);
  }
});
