import crypto from "node:crypto";

// Duplicate protection for CDR rows.
//
// When the file carries a per-record id (e.g. the Rated CDR's "Cdr ID"), that
// id IS the identity: "id:<recordId>". Without one, the key is a hash of the
// row's full content plus its occurrence number within the file — so
// re-uploading the same file is caught, while two genuinely identical charges
// in one file (e.g. two identical SMS rows with no id or timestamp) are both
// kept rather than collapsed into one.

function canonicalRow(raw: Record<string, unknown>): string {
  const keys = Object.keys(raw).sort();
  return JSON.stringify(keys.map((k) => [k.trim().toLowerCase(), String(raw[k] ?? "").trim()]));
}

export function computeDedupeKeys(rows: { sourceRecordId?: string | null; raw: Record<string, unknown> }[]): string[] {
  const occurrences = new Map<string, number>();
  return rows.map((row) => {
    const id = String(row.sourceRecordId ?? "").trim();
    if (id) return `id:${id}`;
    const hash = crypto.createHash("sha256").update(canonicalRow(row.raw)).digest("hex").slice(0, 40);
    const n = occurrences.get(hash) ?? 0;
    occurrences.set(hash, n + 1);
    return `row:${hash}#${n}`;
  });
}

export function hashBuffer(data: Buffer | string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/** Splits a large array for bounded-size $in queries and bulk writes. */
export function chunk<T>(items: T[], size = 1000): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
