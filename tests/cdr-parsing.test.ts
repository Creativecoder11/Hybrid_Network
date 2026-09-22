import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import * as XLSX from "xlsx";
import { Types } from "mongoose";
import { computeDedupeKeys } from "@/lib/cdr/dedupe";
import { parseRetailCsv, parseEventDate } from "@/lib/cdr/retailCsvParser";
import { detectRatedCdrFormat, parseRatedCdrSheet } from "@/lib/cdr/ratedCdrParser";
import { parseGenericSheet } from "@/lib/cdr/genericParser";
import { allocateRow } from "@/lib/cdr/allocation";
import { toCsv } from "@/lib/reports/csv";

test("dedupe: record id is the identity when present", () => {
  const keys = computeDedupeKeys([
    { sourceRecordId: "262957960", raw: { a: "1" } },
    { sourceRecordId: "262957960", raw: { a: "2" } },
  ]);
  assert.equal(keys[0], "id:262957960");
  assert.equal(keys[0], keys[1]);
});

test("dedupe: identical rows without id stay distinct in one file, repeat across uploads", () => {
  const rows = [
    { raw: { Customer: "10001", Product: "245", Amount: "0.10" } },
    { raw: { Customer: "10001", Product: "245", Amount: "0.10" } },
    { raw: { Customer: "10002", Product: "245", Amount: "0.10" } },
  ];
  const first = computeDedupeKeys(rows);
  assert.equal(new Set(first).size, 3, "two identical SMS rows in one file are both kept");
  const reupload = computeDedupeKeys(rows);
  assert.deepEqual(reupload, first, "re-uploading the same file yields the same keys");
  // Column order / surrounding whitespace doesn't change identity.
  const reordered = computeDedupeKeys([{ raw: { Amount: "0.10 ", Product: "245", Customer: "10001" } }]);
  assert.equal(reordered[0], first[0]);
});

test("retail CSV: Product Code and record Type are detected as separate columns", () => {
  const csv = [
    "Customer Code,Type,Product Code,Date,Wholesale Amount,Cdr ID",
    "10001,CALL,123,2026-09-01T10:00:00Z,1.50,A1",
    "10002,SMS,245,2026-09-01T10:05:00Z,0.10,A2",
    "10001,DATA,300,2026-09-01T11:00:00Z,4.00,A3",
    "10003,SMS,,2026-09-01T12:00:00Z,0.10,A4",
    "10001,SMS,245,2026-09-01T12:30:00Z,abc,A5",
  ].join("\n");
  const { detection, rows } = parseRetailCsv(csv);
  assert.equal(detection.customerCodeColumn, "Customer Code");
  assert.equal(detection.identifierColumn, "Product Code");
  assert.equal(detection.recordTypeColumn, "Type");
  assert.equal(detection.dateColumn, "Date");
  assert.equal(detection.recordIdColumn, "Cdr ID");
  assert.equal(rows[0].identifier, "123");
  assert.equal(rows[0].recordType, "CALL");
  assert.equal(rows[0].eventAt?.toISOString(), "2026-09-01T10:00:00.000Z");
  assert.equal(rows[3].isValid, true, "blank product code is an allocation problem, not an unreadable row");
  assert.equal(rows[3].identifier, "");
  assert.equal(rows[4].isValid, false, "non-numeric amount is invalid");
});

test("retail CSV: admin column overrides win over auto-detection", () => {
  const csv = "Acct,Prod Code,Kind,Cost\n10001,123,CALL,1.00";
  const { detection, rows } = parseRetailCsv(csv, { customerCodeColumn: "Acct", recordTypeColumn: "Kind" });
  assert.equal(detection.customerCodeColumn, "Acct");
  assert.equal(rows[0].customerCode, "10001");
  assert.equal(rows[0].recordType, "CALL");
});

test("event dates: ISO strings and Excel serials parse, junk returns null", () => {
  assert.equal(parseEventDate("2026-01-15")?.toISOString().slice(0, 10), "2026-01-15");
  assert.equal(parseEventDate("45694")?.toISOString().slice(0, 10), "2025-02-06");
  assert.equal(parseEventDate("not a date"), null);
  assert.equal(parseEventDate(""), null);
});

test("sample Rated CDR file parses and allocates by Customer Code + Prod", () => {
  const wb = XLSX.readFile(path.join(process.cwd(), "design-reference", "Rated_CDRs-NI-APAC_SUPPORT.xlsx"), { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  assert.equal(detectRatedCdrFormat(sheet), true);
  const parsed = parseRatedCdrSheet(sheet);
  assert.equal(parsed.rows.length, 2, "the grand-totals row is skipped");
  assert.equal(parsed.skippedRows, 1);
  assert.deepEqual(parsed.rows.map((r) => r.cdrId), ["262957960", "263031311"]);
  assert.equal(parsed.rows[0].customerCode, "ZZSP100");
  assert.equal(parsed.rows[0].prod, "Starlink");

  const ctxWith = (products: string[]) => ({
    accountsByNumber: new Map([
      ["ZZSP100", { id: new Types.ObjectId(), customerId: new Types.ObjectId(), accountNumber: "ZZSP100", status: "ACTIVE" as const, allowedProductCodes: new Set<string>() }],
    ]),
    accountsByIccid: new Map(),
    accountsByCardName: new Map(),
    productsByCode: new Map(
      products.map((p) => [p.toLowerCase(), { id: new Types.ObjectId(), code: p, name: p, productType: "DATA" as const, isActive: true, retailPlan: null }])
    ),
  });
  const row = parsed.rows[0];
  const input = { customerCode: row.customerCode, productCode: row.prod, iccid: row.iccid, cardName: row.cardName, requirePricing: false };
  assert.equal(allocateRow(ctxWith(["Starlink"]), input).status, "ALLOCATED");
  const missingProduct = allocateRow(ctxWith([]), input);
  assert.equal(missingProduct.status, "UNALLOCATED", "without a 'Starlink' Product Code the row waits in the Unallocated report");
});

test("generic sheet: missing record ids stay empty (no random ids that defeat dedupe)", () => {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Customer Code", "Prod", "Period", "Volume Data"],
    ["10001", "Starlink", "202609", "100"],
  ]);
  const parsed = parseGenericSheet(sheet);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].cdrId, "");
});

test("CSV reports neutralize spreadsheet formulas from uploaded data", () => {
  const csv = toCsv([{ Code: "=HYPERLINK(\"http://x\")", Amount: -5, Name: "+SUM(A1)" }]);
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /'\+SUM/);
  assert.match(csv, /,-5,/, "numbers are left alone");
});
