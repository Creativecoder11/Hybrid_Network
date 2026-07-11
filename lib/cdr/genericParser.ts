import * as XLSX from "xlsx";
import type { ParsedCdrRow, ParseResult } from "./types";

// Best-effort fallback for CDR exports that don't match the exact Rated-CDR
// format. Matches header names against common variations for each target
// field, then maps rows positionally. Used when detectRatedCdrFormat() is false.
const FIELD_ALIASES: Record<keyof ParsedCdrRow, string[]> = {
  customerCode: ["customer code", "customercode", "account code", "customer id"],
  prod: ["prod", "product"],
  startCdr: ["start cdr", "date", "cdr date", "usage date"],
  iccid: ["iccid", "sim iccid", "terminal id", "kit id"],
  destinationNumber: ["destination number"],
  destinationNetwork: ["destination network"],
  destinationCountry: ["destination country"],
  destinationState: ["destination state"],
  imei: ["imei"],
  service: ["service"],
  cardName: ["card name", "account name"],
  originNumber: ["origin number"],
  originCountry: ["origin country"],
  originIpAddress: ["origin ipaddress", "origin ip address", "origin ip"],
  originRegion: ["origin region"],
  originState: ["origin state"],
  volumeDataBytes: ["volume total volume data (bytes)", "data bytes", "data volume (bytes)", "data usage (bytes)"],
  volumeMin: ["volume total volume min", "voice minutes", "minutes"],
  volumeMsg: ["volume total volume msg", "sms count", "messages"],
  volumeInBundleBytes: ["volume in bundle", "in bundle (bytes)"],
  volumeOutBundleBytes: ["volume out bundle", "out bundle (bytes)"],
  volumeTotalBytes: ["volume total", "total volume (bytes)"],
  consumptionMoney: ["bundle consumption money", "consumption money"],
  consumptionDataBytes: ["bundle consumption data (bytes)", "consumption data (bytes)"],
  consumptionMin: ["bundle consumption min", "consumption min"],
  consumptionMsg: ["bundle consumption msg", "consumption msg"],
  priceCurrency: ["cdr price cur", "currency"],
  priceTotal: ["cdr price total", "price total", "total price"],
  priceInBundle: ["cdr price in bundle", "price in bundle"],
  priceInvoiced: ["cdr price invoiced", "price invoiced"],
  period: ["period", "billing period"],
  cdrId: ["cdr id", "cdrid", "record id"],
  vendor: ["vendor", "provider"],
  isFinal: ["final"],
};

function normalize(s: string): string {
  return String(s ?? "").trim().toLowerCase();
}

function num(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function str(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function buildGenericColumnMap(headerRow: unknown[]): Partial<Record<keyof ParsedCdrRow, number>> {
  const normalizedHeaders = headerRow.map((h) => normalize(str(h)));
  const map: Partial<Record<keyof ParsedCdrRow, number>> = {};

  for (const field of Object.keys(FIELD_ALIASES) as (keyof ParsedCdrRow)[]) {
    const aliases = FIELD_ALIASES[field];
    const idx = normalizedHeaders.findIndex((h) => aliases.includes(h));
    if (idx !== -1) map[field] = idx;
  }

  return map;
}

export function parseGenericSheet(sheet: XLSX.WorkSheet): ParseResult {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null });
  const headerRowIndex = rows.findIndex((r) => r && r.some((c) => str(c).length > 0));
  const headerRow = rows[headerRowIndex] ?? [];
  const columnMap = buildGenericColumnMap(headerRow);
  const dataRows = rows.slice(headerRowIndex + 1);

  const parseErrors: string[] = [];
  if (!columnMap.customerCode && !columnMap.iccid && !columnMap.cardName) {
    parseErrors.push(
      "Couldn't find a Customer Code, ICCID, or Card Name column — this file's format isn't recognized."
    );
  }

  const parsed: ParsedCdrRow[] = [];
  let skippedRows = 0;

  const get = (row: unknown[], field: keyof ParsedCdrRow) =>
    columnMap[field] !== undefined ? row[columnMap[field] as number] : null;

  dataRows.forEach((row) => {
    if (!row || row.length === 0) return;
    const customerCode = str(get(row, "customerCode"));
    const iccid = str(get(row, "iccid"));
    const cardName = str(get(row, "cardName"));
    if (!customerCode && !iccid && !cardName) {
      skippedRows++;
      return;
    }

    const startCdrRaw = get(row, "startCdr");

    parsed.push({
      customerCode,
      prod: str(get(row, "prod")),
      startCdr: startCdrRaw instanceof Date ? startCdrRaw : null,
      iccid,
      destinationNumber: str(get(row, "destinationNumber")),
      destinationNetwork: str(get(row, "destinationNetwork")),
      destinationCountry: str(get(row, "destinationCountry")),
      destinationState: str(get(row, "destinationState")),
      imei: str(get(row, "imei")),
      service: str(get(row, "service")),
      cardName,
      originNumber: str(get(row, "originNumber")),
      originCountry: str(get(row, "originCountry")),
      originIpAddress: str(get(row, "originIpAddress")),
      originRegion: str(get(row, "originRegion")),
      originState: str(get(row, "originState")),

      volumeDataBytes: num(get(row, "volumeDataBytes")),
      volumeMin: num(get(row, "volumeMin")),
      volumeMsg: num(get(row, "volumeMsg")),
      volumeInBundleBytes: num(get(row, "volumeInBundleBytes")),
      volumeOutBundleBytes: num(get(row, "volumeOutBundleBytes")),
      volumeTotalBytes: num(get(row, "volumeTotalBytes")),

      consumptionMoney: num(get(row, "consumptionMoney")),
      consumptionDataBytes: num(get(row, "consumptionDataBytes")),
      consumptionMin: num(get(row, "consumptionMin")),
      consumptionMsg: num(get(row, "consumptionMsg")),

      priceCurrency: str(get(row, "priceCurrency")) || "USD",
      priceTotal: num(get(row, "priceTotal")),
      priceInBundle: num(get(row, "priceInBundle")),
      priceInvoiced: num(get(row, "priceInvoiced")),

      period: str(get(row, "period")),
      cdrId: str(get(row, "cdrId")) || crypto.randomUUID(),
      vendor: str(get(row, "vendor")),
      isFinal: Boolean(get(row, "isFinal")),
    });
  });

  return {
    format: "GENERIC",
    rows: parsed,
    totalDataRows: dataRows.length,
    skippedRows,
    parseErrors,
  };
}
