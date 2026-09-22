import Papa from "papaparse";

export type ColumnDetection = {
  headers: string[];
  identifierColumn: string | null;
  wholesaleColumn: string | null;
  descriptionColumn: string | null;
  recordIdColumn: string | null;
  customerCodeColumn: string | null;
  iccidColumn: string | null;
  cardNameColumn: string | null;
  currencyColumn: string | null;
  recordTypeColumn: string | null;
  dateColumn: string | null;
};

export type RetailCsvRow = {
  rowNumber: number;
  raw: Record<string, string>;
  identifier: string;
  description: string;
  sourceRecordId: string;
  customerCode: string;
  iccid: string;
  cardName: string;
  currency: string;
  recordType: string;
  eventAt: Date | null;
  wholesaleAmountRaw: string;
  wholesaleAmount: number | null;
  isValid: boolean;
  invalidReason: string;
};

export type RetailCsvParseResult = {
  headers: string[];
  detection: ColumnDetection;
  rows: RetailCsvRow[];
  parseErrors: string[];
};

export type ColumnOverride = {
  identifierColumn?: string | null;
  wholesaleColumn?: string | null;
  descriptionColumn?: string | null;
  customerCodeColumn?: string | null;
  recordTypeColumn?: string | null;
};

// Alias lists are intentionally broad — the client's production CDR is CSV
// and its exact header names weren't confirmed against the sample (an XLSX
// with only 2 data rows), so columns are auto-detected here but always
// remain overridable by the admin in the import preview step.
// The Product Code column. Record-type columns ("Type", "Service Type"...)
// are deliberately NOT here — a row's type (CALL / SMS / DATA) is read
// separately and checked against the product's type.
const IDENTIFIER_ALIASES = [
  "product code",
  "prod code",
  "productcode",
  "prod_code",
  "product_code",
  "identifier",
  "cdr identifier",
  "unique identifier",
  "charge identifier",
  "service identifier",
  "prod",
  "product",
  "call code",
  "sms code",
  "data code",
  "plan code",
  "rate code",
  "charge code",
  "service code",
];

const RECORD_TYPE_ALIASES = [
  "type",
  "record type",
  "cdr type",
  "call type",
  "usage type",
  "event type",
  "traffic type",
  "service type",
];

const DATE_ALIASES = [
  "start cdr",
  "event date",
  "event time",
  "date",
  "datetime",
  "date time",
  "call date",
  "start time",
  "start date",
  "usage date",
  "timestamp",
];

const WHOLESALE_ALIASES = [
  "wholesale charge",
  "wholesale cost",
  "wholesale amount",
  "wholesale",
  "cost",
  "cdr price total",
  "price total",
  "total price",
  "charge amount",
  "amount",
  "cdr price invoiced",
  "price invoiced",
];

const DESCRIPTION_ALIASES = ["service", "description", "product", "service description", "charge description"];

const RECORD_ID_ALIASES = ["cdr id", "cdrid", "record id", "recordid", "transaction id", "reference", "reference number", "unique id"];

// The Customer Code IS the Customer Account Number.
const CUSTOMER_CODE_ALIASES = [
  "customer code",
  "customercode",
  "customer_code",
  "customer account",
  "customer account number",
  "account number",
  "account no",
  "account code",
  "account #",
  "customer id",
  "customerid",
  "account",
];
const ICCID_ALIASES = ["iccid", "sim iccid", "terminal id", "kit id"];
const CARD_NAME_ALIASES = ["card name", "account name"];
const CURRENCY_ALIASES = ["currency", "cdr price cur", "price currency", "cur"];

function normalize(s: string): string {
  return String(s ?? "").trim().toLowerCase();
}

function findFirst(headers: string[], normalized: string[], aliases: string[]): string | null {
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias);
    if (idx !== -1) return headers[idx];
  }
  return null;
}

export function detectColumns(headers: string[]): ColumnDetection {
  const normalized = headers.map(normalize);
  return {
    headers,
    identifierColumn: findFirst(headers, normalized, IDENTIFIER_ALIASES),
    wholesaleColumn: findFirst(headers, normalized, WHOLESALE_ALIASES),
    descriptionColumn: findFirst(headers, normalized, DESCRIPTION_ALIASES),
    recordIdColumn: findFirst(headers, normalized, RECORD_ID_ALIASES),
    customerCodeColumn: findFirst(headers, normalized, CUSTOMER_CODE_ALIASES),
    iccidColumn: findFirst(headers, normalized, ICCID_ALIASES),
    cardNameColumn: findFirst(headers, normalized, CARD_NAME_ALIASES),
    currencyColumn: findFirst(headers, normalized, CURRENCY_ALIASES),
    recordTypeColumn: findFirst(headers, normalized, RECORD_TYPE_ALIASES),
    dateColumn: findFirst(headers, normalized, DATE_ALIASES),
  };
}

/** Parses ISO / common date strings and Excel serial day numbers; null when unreadable. */
export function parseEventDate(raw: string): Date | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  if (/^\d+(\.\d+)?$/.test(v)) {
    const serial = Number(v);
    // Excel serial dates (days since 1899-12-30) for plausible years 1990-2100.
    if (serial > 32874 && serial < 73051) return new Date(Math.round((serial - 25569) * 86400 * 1000));
    return null;
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseWholesaleAmount(raw: string): number | null {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).trim().replace(/[,$]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function parseRetailCsv(csvText: string, columnOverride: ColumnOverride = {}): RetailCsvParseResult {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const headers = result.meta.fields ?? [];
  const autoDetection = detectColumns(headers);
  const identifierColumn = columnOverride.identifierColumn || autoDetection.identifierColumn;
  const wholesaleColumn = columnOverride.wholesaleColumn || autoDetection.wholesaleColumn;
  const descriptionColumn = columnOverride.descriptionColumn || autoDetection.descriptionColumn;
  const customerCodeColumn = columnOverride.customerCodeColumn || autoDetection.customerCodeColumn;
  const recordTypeColumn = columnOverride.recordTypeColumn || autoDetection.recordTypeColumn;
  const detection: ColumnDetection = {
    ...autoDetection,
    identifierColumn,
    wholesaleColumn,
    descriptionColumn,
    customerCodeColumn,
    recordTypeColumn,
  };

  const parseErrors = result.errors
    .filter((e) => e.code !== "TooFewFields" && e.code !== "TooManyFields")
    .map((e) => `Row ${typeof e.row === "number" ? e.row + 2 : "?"}: ${e.message}`);

  const rows: RetailCsvRow[] = result.data.map((raw, i) => {
    const identifier = identifierColumn ? String(raw[identifierColumn] ?? "").trim() : "";
    const wholesaleRaw = wholesaleColumn ? String(raw[wholesaleColumn] ?? "").trim() : "";
    const wholesaleAmount = parseWholesaleAmount(wholesaleRaw);
    const description = detection.descriptionColumn ? String(raw[detection.descriptionColumn] ?? "").trim() : "";
    const sourceRecordId = detection.recordIdColumn ? String(raw[detection.recordIdColumn] ?? "").trim() : "";
    const customerCode = detection.customerCodeColumn ? String(raw[detection.customerCodeColumn] ?? "").trim() : "";
    const iccid = detection.iccidColumn ? String(raw[detection.iccidColumn] ?? "").trim() : "";
    const cardName = detection.cardNameColumn ? String(raw[detection.cardNameColumn] ?? "").trim() : "";
    const currency = (detection.currencyColumn ? String(raw[detection.currencyColumn] ?? "").trim() : "") || "USD";
    const recordType = detection.recordTypeColumn ? String(raw[detection.recordTypeColumn] ?? "").trim() : "";
    const eventAt = detection.dateColumn ? parseEventDate(String(raw[detection.dateColumn] ?? "")) : null;

    let isValid = true;
    let invalidReason = "";
    // A blank Product Code on an otherwise readable row is an allocation
    // problem (reported as Unallocated), not an unreadable row.
    if (!identifierColumn) {
      isValid = false;
      invalidReason = "No Product Code column could be detected in this file.";
    } else if (!wholesaleColumn) {
      isValid = false;
      invalidReason = "No wholesale charge column could be detected in this file.";
    } else if (wholesaleAmount === null) {
      isValid = false;
      invalidReason = "Missing or invalid wholesale amount.";
    } else if (wholesaleAmount < 0) {
      isValid = false;
      invalidReason = "Wholesale amount cannot be negative.";
    }

    return {
      rowNumber: i + 2, // +1 for the header row, +1 to make it 1-indexed
      raw,
      identifier,
      description,
      sourceRecordId,
      customerCode,
      iccid,
      cardName,
      currency,
      recordType,
      eventAt,
      wholesaleAmountRaw: wholesaleRaw,
      wholesaleAmount,
      isValid,
      invalidReason,
    };
  });

  return { headers, detection, rows, parseErrors };
}
