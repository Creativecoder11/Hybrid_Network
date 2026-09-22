import Papa from "papaparse";

// CSV output for admin reports. Cells starting with = + - @ (or tab / CR) are
// prefixed with an apostrophe so values that came from uploaded files can't
// run as spreadsheet formulas when the report is opened in Excel.
function neutralize(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  return Papa.unparse(rows.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, neutralize(v)]))));
}

export function safeFileName(name: string): string {
  return (name || "report").replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 80);
}
