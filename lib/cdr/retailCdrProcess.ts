import "server-only";
import crypto from "node:crypto";
import type { Types } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { CdrImportBatch } from "@/models/CdrImportBatch";
import { CdrChargeRecord } from "@/models/CdrChargeRecord";
import { CdrIdentifierMapping } from "@/models/CdrIdentifierMapping";
import type { PricingMethod } from "@/models/RetailPlan";
import { ActivityLog } from "@/models/ActivityLog";
import { buildCustomerMatchMaps, matchCustomer } from "./matcher";
import { parseRetailCsv, type ColumnOverride, type ColumnDetection, type RetailCsvRow } from "./retailCsvParser";
import { calculateRetailCharge } from "@/lib/billing/pricingEngine";
import { roundCurrency, fromCents } from "@/lib/billing/money";

export function hashFileContent(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

type ActivePlan = {
  _id: Types.ObjectId;
  name: string;
  pricingMethod: PricingMethod;
  markupPercent: number;
  fixedPrice: number;
  currency: string;
};

async function buildActiveRetailPlanMap(): Promise<Map<string, ActivePlan>> {
  const mappings = await CdrIdentifierMapping.find({ isActive: true }).populate("retailPlan").lean();
  const map = new Map<string, ActivePlan>();
  for (const m of mappings) {
    const plan = m.retailPlan as unknown as
      | (ActivePlan & { isActive: boolean })
      | null;
    if (!plan || !plan.isActive) continue;
    map.set(m.identifier.trim().toLowerCase(), plan);
  }
  return map;
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
};

export async function previewRetailCdrImport(params: {
  csvText: string;
  columnOverride?: ColumnOverride;
}): Promise<RetailCdrPreview> {
  await connectDB();
  const { headers, detection, rows, parseErrors } = parseRetailCsv(params.csvText, params.columnOverride);
  const validRows = rows.filter((r) => r.isValid).length;

  const fileHash = hashFileContent(params.csvText);
  const existing = await CdrImportBatch.findOne({ fileHash, status: "COMPLETED" })
    .sort({ createdAt: -1 })
    .lean();

  return {
    headers,
    detection,
    totalRows: rows.length,
    validRows,
    invalidRows: rows.length - validRows,
    sampleRows: rows.slice(0, 25),
    parseErrors,
    duplicateOfBatch: existing
      ? {
          id: existing._id.toString(),
          fileName: existing.fileName,
          createdAt: (existing.createdAt as Date).toISOString(),
        }
      : null,
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
    totalWholesaleAmount: 0,
    totalRetailAmount: 0,
    currency: "USD",
    errorLog,
  };
}

export async function processRetailCdrImport(params: {
  csvText: string;
  fileName: string;
  uploadedBy: string;
  columnOverride?: ColumnOverride;
}): Promise<RetailCdrImportResult> {
  await connectDB();

  const fileHash = hashFileContent(params.csvText);
  const { detection, rows, parseErrors } = parseRetailCsv(params.csvText, params.columnOverride);

  const batch = await CdrImportBatch.create({
    fileName: params.fileName,
    uploadedBy: params.uploadedBy,
    fileHash,
    identifierColumn: detection.identifierColumn ?? "",
    wholesaleColumn: detection.wholesaleColumn ?? "",
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

    const [activePlanMap, customerMatchMaps] = await Promise.all([
      buildActiveRetailPlanMap(),
      buildCustomerMatchMaps(),
    ]);

    let existingRecordIds = new Set<string>();
    if (detection.recordIdColumn) {
      const candidateIds = rows.map((r) => r.sourceRecordId).filter(Boolean);
      if (candidateIds.length > 0) {
        const existing = await CdrChargeRecord.find({ sourceRecordId: { $in: candidateIds } })
          .select("sourceRecordId")
          .lean();
        existingRecordIds = new Set(existing.map((e) => e.sourceRecordId));
      }
    }
    const seenRecordIds = new Set<string>();

    let matchedRows = 0;
    let unmatchedRows = 0;
    let invalidRows = 0;
    let totalWholesaleCents = 0;
    let totalRetailCents = 0;
    let batchCurrency = "";

    const docs: Record<string, unknown>[] = [];

    for (const row of rows) {
      if (!row.isValid) {
        invalidRows++;
        docs.push({
          importBatch: batch._id,
          rowNumber: row.rowNumber,
          identifier: row.identifier,
          description: row.description,
          sourceRecordId: row.sourceRecordId,
          currency: row.currency,
          wholesaleAmount: row.wholesaleAmount ?? 0,
          status: "INVALID",
          errorReason: row.invalidReason,
          rawRow: row.raw,
        });
        continue;
      }

      if (row.sourceRecordId && (seenRecordIds.has(row.sourceRecordId) || existingRecordIds.has(row.sourceRecordId))) {
        invalidRows++;
        docs.push({
          importBatch: batch._id,
          rowNumber: row.rowNumber,
          identifier: row.identifier,
          description: row.description,
          sourceRecordId: row.sourceRecordId,
          currency: row.currency,
          wholesaleAmount: row.wholesaleAmount ?? 0,
          status: "INVALID",
          errorReason: `Duplicate record (${row.sourceRecordId}) — already processed in a previous or earlier row of this import.`,
          rawRow: row.raw,
        });
        continue;
      }
      if (row.sourceRecordId) seenRecordIds.add(row.sourceRecordId);

      const customer = matchCustomer(customerMatchMaps, {
        customerCode: row.customerCode,
        iccid: row.iccid,
        cardName: row.cardName,
      });

      const wholesaleAmount = roundCurrency(row.wholesaleAmount ?? 0);
      const plan = activePlanMap.get(row.identifier.trim().toLowerCase());

      if (!plan) {
        unmatchedRows++;
        totalWholesaleCents += Math.round(wholesaleAmount * 100);
        if (!batchCurrency) batchCurrency = row.currency;
        docs.push({
          importBatch: batch._id,
          rowNumber: row.rowNumber,
          identifier: row.identifier,
          description: row.description,
          sourceRecordId: row.sourceRecordId,
          customer: customer?._id ?? null,
          customerCode: row.customerCode,
          wholesaleAmount,
          currency: row.currency,
          status: "UNMATCHED",
          errorReason: `No active Retail Plan is mapped to identifier "${row.identifier}".`,
          rawRow: row.raw,
        });
        continue;
      }

      const pricing = calculateRetailCharge(wholesaleAmount, {
        pricingMethod: plan.pricingMethod,
        markupPercent: plan.markupPercent,
        fixedPrice: plan.fixedPrice,
      });
      const recordCurrency = plan.currency || row.currency;

      matchedRows++;
      totalWholesaleCents += Math.round(pricing.wholesaleAmount * 100);
      totalRetailCents += Math.round(pricing.retailAmount * 100);
      if (!batchCurrency) batchCurrency = recordCurrency;

      docs.push({
        importBatch: batch._id,
        rowNumber: row.rowNumber,
        identifier: row.identifier,
        description: row.description,
        sourceRecordId: row.sourceRecordId,
        customer: customer?._id ?? null,
        customerCode: row.customerCode,
        wholesaleAmount: pricing.wholesaleAmount,
        currency: recordCurrency,
        retailPlan: plan._id,
        retailPlanName: plan.name,
        pricingMethodUsed: pricing.pricingMethod,
        markupPercentUsed: pricing.markupPercentUsed,
        fixedPriceUsed: pricing.fixedPriceUsed,
        retailAmount: pricing.retailAmount,
        status: "MATCHED",
        rawRow: row.raw,
      });
    }

    if (docs.length > 0) {
      await CdrChargeRecord.insertMany(docs, { ordered: false });
    }

    const matchedCustomerIds = docs
      .map((d) => d.customer)
      .filter((c): c is Types.ObjectId => Boolean(c));
    if (matchedCustomerIds.length > 0) {
      const { processTemporaryCredentialsForCustomers } = await import("@/lib/auth/temporaryCredentials");
      await processTemporaryCredentialsForCustomers(matchedCustomerIds, {
        actorId: params.uploadedBy,
        reason: "CDR_PRICING_IMPORT",
      });
    }

    const processedRows = matchedRows + unmatchedRows;
    const totalWholesaleAmount = fromCents(totalWholesaleCents);
    const totalRetailAmount = fromCents(totalRetailCents);
    const currency = batchCurrency || "USD";

    await CdrImportBatch.findByIdAndUpdate(batch._id, {
      status: "COMPLETED",
      totalRows: rows.length,
      processedRows,
      matchedRows,
      unmatchedRows,
      invalidRows,
      totalWholesaleAmount,
      totalRetailAmount,
      currency,
      errorLog,
    });

    await ActivityLog.create({
      actor: params.uploadedBy,
      action: "CDR_PRICING_IMPORT",
      meta: { batchId, fileName: params.fileName, totalRows: rows.length, matchedRows, unmatchedRows, invalidRows },
    });

    return {
      batchId,
      status: "COMPLETED",
      totalRows: rows.length,
      processedRows,
      matchedRows,
      unmatchedRows,
      invalidRows,
      totalWholesaleAmount,
      totalRetailAmount,
      currency,
      errorLog,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error while processing the file.";
    const finalErrorLog = [...errorLog, message];
    await CdrImportBatch.findByIdAndUpdate(batch._id, { status: "FAILED", errorLog: finalErrorLog });
    return failedResult(batchId, finalErrorLog);
  }
}

/**
 * Re-runs pricing for a batch's currently UNMATCHED records against the
 * live mapping table — used after an admin maps a previously-unmatched
 * identifier to a Retail Plan, without needing to re-upload the file.
 */
export async function reprocessUnmatchedRecords(
  batchId: string
): Promise<{ reMatched: number; stillUnmatched: number }> {
  await connectDB();

  const unmatchedRecords = await CdrChargeRecord.find({ importBatch: batchId, status: "UNMATCHED" });
  if (unmatchedRecords.length === 0) return { reMatched: 0, stillUnmatched: 0 };

  const activePlanMap = await buildActiveRetailPlanMap();

  let reMatched = 0;
  let stillUnmatched = 0;
  let addedRetailCents = 0;

  for (const record of unmatchedRecords) {
    const plan = activePlanMap.get(record.identifier.trim().toLowerCase());
    if (!plan) {
      stillUnmatched++;
      continue;
    }

    const pricing = calculateRetailCharge(record.wholesaleAmount, {
      pricingMethod: plan.pricingMethod,
      markupPercent: plan.markupPercent,
      fixedPrice: plan.fixedPrice,
    });

    record.retailPlan = plan._id;
    record.retailPlanName = plan.name;
    record.pricingMethodUsed = pricing.pricingMethod;
    record.markupPercentUsed = pricing.markupPercentUsed ?? undefined;
    record.fixedPriceUsed = pricing.fixedPriceUsed ?? undefined;
    record.retailAmount = pricing.retailAmount;
    record.status = "MATCHED";
    record.errorReason = "";
    await record.save();

    reMatched++;
    addedRetailCents += Math.round(pricing.retailAmount * 100);
  }

  if (reMatched > 0) {
    await CdrImportBatch.findByIdAndUpdate(batchId, {
      $inc: {
        matchedRows: reMatched,
        unmatchedRows: -reMatched,
        totalRetailAmount: fromCents(addedRetailCents),
      },
    });
  }

  return { reMatched, stillUnmatched };
}
