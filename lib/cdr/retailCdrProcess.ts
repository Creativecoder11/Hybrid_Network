import "server-only";
import mongoose, { type Types } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { CdrImportBatch } from "@/models/CdrImportBatch";
import { CdrChargeRecord } from "@/models/CdrChargeRecord";
import { ActivityLog } from "@/models/ActivityLog";
import { parseRetailCsv, type ColumnOverride, type ColumnDetection, type RetailCsvRow } from "./retailCsvParser";
import { allocateRow, buildAllocationContext, type AccountRef, type AllocationContext } from "./allocation";
import { computeDedupeKeys, hashBuffer, chunk } from "./dedupe";
import { notifyUnallocatedRecords } from "./alerts";
import { calculateRetailCharge } from "@/lib/billing/pricingEngine";
import { roundCurrency } from "@/lib/billing/money";

// Retail CDR pricing import (Admin -> Billing -> CDR Import).
//
// Upload -> parse -> validate -> allocate each row to Customer Account +
// Product Code -> price allocated rows with the product's Retail Plan ->
// bulk insert -> totals computed from what was actually stored -> alert on
// unallocated rows. Works the same for a single-customer file and a bulk
// file mixing many customer codes. Nothing here creates customers or accounts.

export function hashFileContent(text: string): string {
  return hashBuffer(text);
}

export type RetailCdrPreview = {
  headers: string[];
  detection: ColumnDetection;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  sampleRows: RetailCsvRow[];
  parseErrors: string[];
  duplicateOfBatch: { id: string; fileName: string; createdAt: string } | null;
  /** Distinct customer codes in the file — 1 means a single-customer file. */
  distinctCustomerCodes: number;
  /** Preview of allocation for the valid rows, before anything is stored. */
  allocationPreview: { allocated: number; unallocated: number; unknownCustomerCodes: string[]; unknownProductCodes: string[] };
};

export async function previewRetailCdrImport(params: {
  csvText: string;
  columnOverride?: ColumnOverride;
}): Promise<RetailCdrPreview> {
  await connectDB();
  const { headers, detection, rows, parseErrors } = parseRetailCsv(params.csvText, params.columnOverride);
  const validRows = rows.filter((r) => r.isValid);

  const fileHash = hashFileContent(params.csvText);
  const [existing, ctx] = await Promise.all([
    CdrImportBatch.findOne({ fileHash, status: "COMPLETED" }).sort({ createdAt: -1 }).lean(),
    buildAllocationContext(),
  ]);

  let allocated = 0;
  const unknownCustomers = new Set<string>();
  const unknownProducts = new Set<string>();
  for (const row of validRows) {
    const result = allocateRow(ctx, {
      customerCode: row.customerCode,
      productCode: row.identifier,
      recordType: row.recordType,
      iccid: row.iccid,
      cardName: row.cardName,
      requirePricing: true,
    });
    if (result.status === "ALLOCATED") allocated++;
    else {
      if (!result.account && row.customerCode) unknownCustomers.add(row.customerCode);
      if (!result.product && row.identifier) unknownProducts.add(row.identifier);
    }
  }

  return {
    headers,
    detection,
    totalRows: rows.length,
    validRows: validRows.length,
    invalidRows: rows.length - validRows.length,
    sampleRows: rows.slice(0, 25),
    parseErrors,
    duplicateOfBatch: existing
      ? { id: existing._id.toString(), fileName: existing.fileName, createdAt: (existing.createdAt as Date).toISOString() }
      : null,
    distinctCustomerCodes: new Set(rows.map((r) => r.customerCode.trim().toUpperCase()).filter(Boolean)).size,
    allocationPreview: {
      allocated,
      unallocated: validRows.length - allocated,
      unknownCustomerCodes: Array.from(unknownCustomers).slice(0, 50),
      unknownProductCodes: Array.from(unknownProducts).slice(0, 50),
    },
  };
}

export type RetailCdrImportResult = {
  batchId: string;
  status: "COMPLETED" | "FAILED";
  totalRows: number;
  processedRows: number;
  matchedRows: number;
  unmatchedRows: number;
  invalidRows: number;
  duplicateRows: number;
  totalWholesaleAmount: number;
  totalRetailAmount: number;
  currency: string;
  errorLog: string[];
};

function failedResult(batchId: string, errorLog: string[]): RetailCdrImportResult {
  return {
    batchId,
    status: "FAILED",
    totalRows: 0,
    processedRows: 0,
    matchedRows: 0,
    unmatchedRows: 0,
    invalidRows: 0,
    duplicateRows: 0,
    totalWholesaleAmount: 0,
    totalRetailAmount: 0,
    currency: "USD",
    errorLog,
  };
}

type ChargeDoc = Record<string, unknown> & { status: string; dedupeKey: string; dedupeActive: boolean };

function pricedFields(ctx: AllocationContext, row: RetailCsvRow, forcedAccount?: AccountRef | null) {
  const wholesaleAmount = roundCurrency(row.wholesaleAmount ?? 0);
  const result = allocateRow(ctx, {
    customerCode: row.customerCode,
    productCode: row.identifier,
    recordType: row.recordType,
    iccid: row.iccid,
    cardName: row.cardName,
    requirePricing: true,
    forcedAccount,
  });

  const shared = {
    customer: result.account?.customerId ?? null,
    customerAccount: result.account?.id ?? null,
    product: result.product?.id ?? null,
    productName: result.product?.name ?? "",
    productType: result.product?.productType ?? null,
  };

  if (result.status === "UNALLOCATED" || !result.product.retailPlan) {
    return {
      ...shared,
      status: "UNMATCHED" as const,
      wholesaleAmount,
      currency: row.currency,
      unallocatedReasonCode: result.status === "UNALLOCATED" ? result.reasonCode : "PRODUCT_HAS_NO_PRICING",
      errorReason: result.status === "UNALLOCATED" ? result.reason : "Product has no active Retail Plan for pricing.",
    };
  }

  const plan = result.product.retailPlan;
  const pricing = calculateRetailCharge(wholesaleAmount, {
    pricingMethod: plan.pricingMethod,
    markupPercent: plan.markupPercent,
    fixedPrice: plan.fixedPrice,
  });
  return {
    ...shared,
    status: "MATCHED" as const,
    wholesaleAmount: pricing.wholesaleAmount,
    currency: plan.currency || row.currency,
    retailPlan: plan._id,
    retailPlanName: plan.name,
    pricingMethodUsed: pricing.pricingMethod,
    markupPercentUsed: pricing.markupPercentUsed,
    fixedPriceUsed: pricing.fixedPriceUsed,
    retailAmount: pricing.retailAmount,
    unallocatedReasonCode: null,
    errorReason: "",
  };
}

/** Normalizes the write errors of a bulk insert (driver / Mongoose shapes differ). */
export function bulkWriteErrors(err: unknown): { index: number; code: number }[] {
  const list = (err as { writeErrors?: unknown }).writeErrors;
  const arr = Array.isArray(list) ? list : list ? [list] : [];
  return arr.map((w: { index?: number; code?: number; err?: { index?: number; code?: number } }) => ({
    index: Number(w.index ?? w.err?.index),
    code: Number(w.code ?? w.err?.code),
  }));
}

/**
 * Inserts in chunks. If the unique dedupe index rejects rows (a concurrent
 * upload of overlapping records won the race), those rows are stored as
 * DUPLICATE instead so every row of the file is still accounted for.
 */
async function insertCharges(docs: ChargeDoc[]): Promise<void> {
  for (const part of chunk(docs, 1000)) {
    try {
      await CdrChargeRecord.insertMany(part, { ordered: false });
    } catch (err) {
      const errors = bulkWriteErrors(err);
      if (errors.length === 0 || errors.some((e) => e.code !== 11000)) throw err;
      const failed = new Set(errors.map((e) => e.index));
      const retry = part
        .filter((_, i) => failed.has(i))
        .map((d) => ({
          ...d,
          status: "DUPLICATE",
          dedupeActive: false,
          unallocatedReasonCode: null,
          errorReason: "Duplicate record — already processed by another upload.",
        }));
      if (retry.length > 0) await CdrChargeRecord.insertMany(retry, { ordered: false });
    }
  }
}

/** Batch totals recomputed from the stored records (the source of truth). */
async function summarizeBatch(batchId: Types.ObjectId) {
  const rows = await CdrChargeRecord.aggregate<{ _id: string; count: number; wholesale: number; retail: number }>([
    { $match: { importBatch: batchId } },
    { $group: { _id: "$status", count: { $sum: 1 }, wholesale: { $sum: "$wholesaleAmount" }, retail: { $sum: "$retailAmount" } } },
  ]);
  const by = new Map(rows.map((r) => [r._id, r]));
  const reasonRows = await CdrChargeRecord.aggregate<{ _id: string | null; count: number }>([
    { $match: { importBatch: batchId, status: "UNMATCHED" } },
    { $group: { _id: "$unallocatedReasonCode", count: { $sum: 1 } } },
  ]);
  return {
    matchedRows: by.get("MATCHED")?.count ?? 0,
    unmatchedRows: by.get("UNMATCHED")?.count ?? 0,
    invalidRows: by.get("INVALID")?.count ?? 0,
    duplicateRows: by.get("DUPLICATE")?.count ?? 0,
    totalWholesaleAmount: roundCurrency((by.get("MATCHED")?.wholesale ?? 0) + (by.get("UNMATCHED")?.wholesale ?? 0)),
    totalRetailAmount: roundCurrency(by.get("MATCHED")?.retail ?? 0),
    reasonCounts: Object.fromEntries(reasonRows.map((r) => [r._id ?? "UNKNOWN", r.count])),
  };
}

export async function processRetailCdrImport(params: {
  csvText: string;
  fileName: string;
  uploadedBy: string;
  columnOverride?: ColumnOverride;
}): Promise<RetailCdrImportResult> {
  const startedAt = Date.now();
  await connectDB();

  const fileHash = hashFileContent(params.csvText);
  const { detection, rows, parseErrors } = parseRetailCsv(params.csvText, params.columnOverride);

  const batch = await CdrImportBatch.create({
    fileName: params.fileName,
    uploadedBy: params.uploadedBy,
    fileHash,
    identifierColumn: detection.identifierColumn ?? "",
    wholesaleColumn: detection.wholesaleColumn ?? "",
    customerCodeColumn: detection.customerCodeColumn ?? "",
    recordTypeColumn: detection.recordTypeColumn ?? "",
    dateColumn: detection.dateColumn ?? "",
    status: "PROCESSING",
  });
  const batchId = batch._id.toString();
  const errorLog: string[] = [...parseErrors];

  try {
    if (rows.length === 0) {
      const finalErrorLog = [...errorLog, "No usable data rows were found in this file."];
      await CdrImportBatch.findByIdAndUpdate(batch._id, { status: "FAILED", errorLog: finalErrorLog });
      return failedResult(batchId, finalErrorLog);
    }
    if (!detection.customerCodeColumn) {
      errorLog.push("No Customer Code / Account Number column was detected — rows can only be allocated by ICCID or card name.");
    }

    const ctx = await buildAllocationContext();
    const keys = computeDedupeKeys(rows.map((r) => ({ sourceRecordId: r.sourceRecordId, raw: r.raw })));

    // Already-processed records: by dedupe key, plus by source record id for
    // records imported before dedupe keys existed.
    const existingKeys = new Set<string>();
    for (const part of chunk(keys)) {
      const found = await CdrChargeRecord.find({ dedupeKey: { $in: part }, dedupeActive: true }).select("dedupeKey").lean();
      for (const f of found) existingKeys.add(f.dedupeKey);
    }
    const ids = rows.map((r) => r.sourceRecordId).filter(Boolean);
    const existingIds = new Set<string>();
    for (const part of chunk(ids)) {
      const found = await CdrChargeRecord.find({ sourceRecordId: { $in: part }, status: { $in: ["MATCHED", "UNMATCHED"] } })
        .select("sourceRecordId")
        .lean();
      for (const f of found) existingIds.add(f.sourceRecordId);
    }

    const seenInFile = new Set<string>();
    const docs: ChargeDoc[] = rows.map((row, i) => {
      const key = keys[i];
      const base = {
        importBatch: batch._id,
        rowNumber: row.rowNumber,
        identifier: row.identifier,
        description: row.description,
        sourceRecordId: row.sourceRecordId,
        customerCode: row.customerCode,
        recordType: row.recordType,
        eventAt: row.eventAt,
        currency: row.currency,
        rawRow: row.raw,
        dedupeKey: key,
      };

      if (!row.isValid) {
        return { ...base, wholesaleAmount: row.wholesaleAmount ?? 0, status: "INVALID", dedupeActive: false, errorReason: row.invalidReason };
      }
      if (seenInFile.has(key) || existingKeys.has(key) || (row.sourceRecordId && existingIds.has(row.sourceRecordId))) {
        return {
          ...base,
          wholesaleAmount: row.wholesaleAmount ?? 0,
          status: "DUPLICATE",
          dedupeActive: false,
          errorReason: row.sourceRecordId
            ? `Duplicate record (${row.sourceRecordId}) — already processed in an earlier row or upload.`
            : "Duplicate record — identical row already processed in an earlier upload.",
        };
      }
      seenInFile.add(key);
      return { ...base, ...pricedFields(ctx, row), dedupeActive: true };
    });

    await insertCharges(docs);

    const summary = await summarizeBatch(batch._id);
    const distinctCustomerCodes = new Set(rows.map((r) => r.customerCode.trim().toUpperCase()).filter(Boolean)).size;
    const currency = (docs.find((d) => d.status === "MATCHED")?.currency as string | undefined) ?? rows[0]?.currency ?? "USD";

    await CdrImportBatch.findByIdAndUpdate(batch._id, {
      status: "COMPLETED",
      totalRows: rows.length,
      processedRows: summary.matchedRows + summary.unmatchedRows,
      matchedRows: summary.matchedRows,
      unmatchedRows: summary.unmatchedRows,
      invalidRows: summary.invalidRows,
      duplicateRows: summary.duplicateRows,
      distinctCustomerCodes,
      totalWholesaleAmount: summary.totalWholesaleAmount,
      totalRetailAmount: summary.totalRetailAmount,
      currency,
      errorLog,
      processingMs: Date.now() - startedAt,
    });

    await ActivityLog.create({
      actor: params.uploadedBy,
      action: "CDR_PRICING_IMPORT",
      meta: {
        batchId,
        fileName: params.fileName,
        totalRows: rows.length,
        allocatedRows: summary.matchedRows,
        unallocatedRows: summary.unmatchedRows,
        invalidRows: summary.invalidRows,
        duplicateRows: summary.duplicateRows,
        distinctCustomerCodes,
      },
    });

    await notifyUnallocatedRecords({
      pipeline: "RETAIL",
      batchId,
      fileName: params.fileName,
      uploadedById: params.uploadedBy,
      totalRows: rows.length,
      allocatedRows: summary.matchedRows,
      unallocatedRows: summary.unmatchedRows,
      reasonCounts: summary.reasonCounts,
    });

    return {
      batchId,
      status: "COMPLETED",
      totalRows: rows.length,
      processedRows: summary.matchedRows + summary.unmatchedRows,
      matchedRows: summary.matchedRows,
      unmatchedRows: summary.unmatchedRows,
      invalidRows: summary.invalidRows,
      duplicateRows: summary.duplicateRows,
      totalWholesaleAmount: summary.totalWholesaleAmount,
      totalRetailAmount: summary.totalRetailAmount,
      currency,
      errorLog,
    };
  } catch (err) {
    console.error(`[cdr-import] batch ${batchId} failed`, err);
    const message = err instanceof Error ? err.message : "Unknown error while processing the file.";
    const finalErrorLog = [...errorLog, message];
    await CdrImportBatch.findByIdAndUpdate(batch._id, { status: "FAILED", errorLog: finalErrorLog, processingMs: Date.now() - startedAt });
    return failedResult(batchId, finalErrorLog);
  }
}

/**
 * Re-runs allocation + pricing for a batch's UNMATCHED (unallocated) records
 * against the current Customer Accounts and Product Codes — used after an
 * admin adds the missing account / product, without re-uploading the file.
 */
export async function reprocessUnmatchedRecords(
  batchId: string,
  adminId: string,
  options?: { recordIds?: string[]; forcedAccountId?: string }
): Promise<{ reMatched: number; stillUnmatched: number }> {
  await connectDB();
  if (!mongoose.isValidObjectId(batchId)) return { reMatched: 0, stillUnmatched: 0 };

  const filter: Record<string, unknown> = { importBatch: batchId, status: "UNMATCHED" };
  if (options?.recordIds) filter._id = { $in: options.recordIds.filter((id) => mongoose.isValidObjectId(id)) };
  const records = await CdrChargeRecord.find(filter).lean();
  if (records.length === 0) return { reMatched: 0, stillUnmatched: 0 };

  const ctx = await buildAllocationContext();
  const forcedAccount = options?.forcedAccountId
    ? (Array.from(ctx.accountsByNumber.values()).find((a) => a.id.toString() === options.forcedAccountId) ?? null)
    : null;
  if (options?.forcedAccountId && !forcedAccount) return { reMatched: 0, stillUnmatched: records.length };

  let reMatched = 0;
  const ops = records.map((record) => {
    const row = {
      identifier: record.identifier,
      customerCode: record.customerCode,
      recordType: record.recordType ?? "",
      iccid: "",
      cardName: "",
      wholesaleAmount: record.wholesaleAmount,
      currency: record.currency,
    } as unknown as RetailCsvRow;
    const fields = pricedFields(ctx, row, forcedAccount);
    if (fields.status === "MATCHED") reMatched++;
    return {
      updateOne: {
        filter: { _id: record._id, status: "UNMATCHED" },
        update: {
          $set: {
            ...fields,
            ...(fields.status === "MATCHED" ? { resolvedAt: new Date(), resolvedBy: adminId } : {}),
          },
        },
      },
    };
  });
  type ChargeWrite = Parameters<typeof CdrChargeRecord.bulkWrite>[0][number];
  for (const part of chunk(ops as unknown as ChargeWrite[], 500)) await CdrChargeRecord.bulkWrite(part, { ordered: false });

  const summary = await summarizeBatch(new mongoose.Types.ObjectId(batchId));
  await CdrImportBatch.findByIdAndUpdate(batchId, {
    matchedRows: summary.matchedRows,
    unmatchedRows: summary.unmatchedRows,
    processedRows: summary.matchedRows + summary.unmatchedRows,
    totalWholesaleAmount: summary.totalWholesaleAmount,
    totalRetailAmount: summary.totalRetailAmount,
  });

  return { reMatched, stillUnmatched: records.length - reMatched };
}

