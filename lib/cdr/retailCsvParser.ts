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
};

// Alias lists are intentionally broad — the client's production CDR is CSV
// and its exact header names weren't confirmed against the sample (an XLSX
// with only 2 data rows), so columns are auto-detected here but always
// remain overridable by the admin in the import preview step.
const IDENTIFIER_ALIASES = [
  "identifier",
  "cdr identifier",
  "unique identifier",
  "charge identifier",
  "service identifier",
  "product code",
  "prod",
  "product",
  "plan code",
  "rate code",
  "charge code",
  "service code",
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

const CUSTOMER_CODE_ALIASES = ["customer code", "customercode", "account code", "customer id"];
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
  };
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
  const detection: ColumnDetection = { ...autoDetection, identifierColumn, wholesaleColumn, descriptionColumn };

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

    let isValid = true;
    let invalidReason = "";
    if (!identifierColumn) {
      isValid = false;
      invalidReason = "No identifier column could be detected in this file.";
    } else if (!identifier) {
      isValid = false;
      invalidReason = "Missing CDR identifier.";
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
      wholesaleAmountRaw: wholesaleRaw,
      wholesaleAmount,
      isValid,
      invalidReason,
    };
  });

  return { headers, detection, rows, parseErrors };
}
