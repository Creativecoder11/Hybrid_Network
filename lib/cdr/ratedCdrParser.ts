import * as XLSX from "xlsx";
import type { ParsedCdrRow, ParseResult } from "./types";

// The exact flattened column names on row 3 (0-indexed row 2) of a Rated-CDR export.
const RATED_CDR_SIGNATURE_COLUMNS = [
  "Customer Code",
  "Prod",
  "Start CDR",
  "ICCID",
  "Cdr ID",
  "Volume Total Volume Data (Bytes)",
  "Bundle Consumption Data (Bytes)",
  "CDR Price Cur",
];

const COLUMN_INDEX: Record<string, number> = {
  customerCode: 0,
  prod: 1,
  startCdr: 2,
  iccid: 3,
  destinationNumber: 4,
  destinationNetwork: 5,
  destinationCountry: 6,
  destinationState: 7,
  imei: 8,
  service: 9,
  cardName: 10,
  originNumber: 11,
  originCountry: 12,
  originIpAddress: 13,
  originRegion: 14,
  originState: 15,
  volumeDataBytes: 16,
  volumeMin: 17,
  volumeMsg: 18,
  volumeInBundleBytes: 19,
  volumeOutBundleBytes: 20,
  volumeTotalBytes: 21,
  consumptionMoney: 22,
  consumptionDataBytes: 23,
  consumptionMin: 24,
  consumptionMsg: 25,
  priceCurrency: 26,
  priceTotal: 27,
  priceInBundle: 28,
  priceInvoiced: 29,
  period: 30,
  cdrId: 31,
  vendor: 32,
  isFinal: 33,
};

function num(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function str(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * Detects whether a workbook matches the exact Rated-CDR export format by
 * checking for its known row-3 header names (rows 1-2 are merged group
 * headers; header is on row 3 / index 2).
 */
export function detectRatedCdrFormat(sheet: XLSX.WorkSheet): boolean {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null });
  const headerRow = rows[2];
  if (!headerRow) return false;
  const headerSet = new Set(headerRow.map((c) => str(c)));
  return RATED_CDR_SIGNATURE_COLUMNS.every((col) => headerSet.has(col));
}

export function parseRatedCdrSheet(sheet: XLSX.WorkSheet): ParseResult {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null });
  const dataRows = rows.slice(3); // rows 1-2: group headers, row 3: column names, row 4+: data

  const parsed: ParsedCdrRow[] = [];
  const parseErrors: string[] = [];
  let skippedRows = 0;

  dataRows.forEach((row, i) => {
    if (!row || row.length === 0) return;

    const customerCode = str(row[COLUMN_INDEX.customerCode]);
    // The grand-totals row has an empty Customer Code and only sum columns filled — skip it.
    if (!customerCode) {
      skippedRows++;
      return;
    }

    try {
      const startCdrRaw = row[COLUMN_INDEX.startCdr];
      const startCdr = startCdrRaw instanceof Date ? startCdrRaw : null;

      parsed.push({
        customerCode,
        prod: str(row[COLUMN_INDEX.prod]),
        startCdr,
        iccid: str(row[COLUMN_INDEX.iccid]),
        destinationNumber: str(row[COLUMN_INDEX.destinationNumber]),
        destinationNetwork: str(row[COLUMN_INDEX.destinationNetwork]),
        destinationCountry: str(row[COLUMN_INDEX.destinationCountry]),
        destinationState: str(row[COLUMN_INDEX.destinationState]),
        imei: str(row[COLUMN_INDEX.imei]),
        service: str(row[COLUMN_INDEX.service]),
        cardName: str(row[COLUMN_INDEX.cardName]),
        originNumber: str(row[COLUMN_INDEX.originNumber]),
        originCountry: str(row[COLUMN_INDEX.originCountry]),
        originIpAddress: str(row[COLUMN_INDEX.originIpAddress]),
        originRegion: str(row[COLUMN_INDEX.originRegion]),
        originState: str(row[COLUMN_INDEX.originState]),

        volumeDataBytes: num(row[COLUMN_INDEX.volumeDataBytes]),
        volumeMin: num(row[COLUMN_INDEX.volumeMin]),
        volumeMsg: num(row[COLUMN_INDEX.volumeMsg]),
        volumeInBundleBytes: num(row[COLUMN_INDEX.volumeInBundleBytes]),
        volumeOutBundleBytes: num(row[COLUMN_INDEX.volumeOutBundleBytes]),
        volumeTotalBytes: num(row[COLUMN_INDEX.volumeTotalBytes]),

        consumptionMoney: num(row[COLUMN_INDEX.consumptionMoney]),
        consumptionDataBytes: num(row[COLUMN_INDEX.consumptionDataBytes]),
        consumptionMin: num(row[COLUMN_INDEX.consumptionMin]),
        consumptionMsg: num(row[COLUMN_INDEX.consumptionMsg]),

        priceCurrency: str(row[COLUMN_INDEX.priceCurrency]) || "MYR",
        priceTotal: num(row[COLUMN_INDEX.priceTotal]),
        priceInBundle: num(row[COLUMN_INDEX.priceInBundle]),
        priceInvoiced: num(row[COLUMN_INDEX.priceInvoiced]),

        period: str(row[COLUMN_INDEX.period]),
        cdrId: str(row[COLUMN_INDEX.cdrId]),
        vendor: str(row[COLUMN_INDEX.vendor]),
        isFinal: Boolean(row[COLUMN_INDEX.isFinal]),
      });
    } catch (err) {
      parseErrors.push(`Row ${i + 4}: ${err instanceof Error ? err.message : "failed to parse"}`);
    }
  });

  return {
    format: "RATED_CDR",
    rows: parsed,
    totalDataRows: dataRows.length,
    skippedRows,
    parseErrors,
  };
}
