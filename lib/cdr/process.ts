import "server-only";
import mongoose from "mongoose";
import * as XLSX from "xlsx";
import { connectDB } from "@/lib/db/connect";
import { CdrBatch, type CdrUploadMode } from "@/models/CdrBatch";
import { CdrRecord } from "@/models/CdrRecord";
import { ActivityLog } from "@/models/ActivityLog";
import { detectRatedCdrFormat, parseRatedCdrSheet } from "./ratedCdrParser";
import { parseGenericSheet } from "./genericParser";
import { allocateRow, buildAllocationContext, type AccountRef } from "./allocation";
import { computeDedupeKeys, hashBuffer, chunk } from "./dedupe";
import { notifyUnallocatedRecords } from "./alerts";
import { groupByAccountPeriod, upsertUsageRecords, type MatchedCdrRow } from "./aggregator";
import type { ParsedCdrRow } from "./types";

// Usage CDR upload (Admin -> CDR Upload): Rated CDR / generic usage files.
//
// Each row is allocated on Customer Code -> Customer Account and Product Code
// ("Prod") -> Product. Allocated rows feed monthly usage per account;
// unallocated rows are stored with a reason for the report, alert and admin
// follow-up. Rows already processed by an earlier upload (same Cdr ID, or the
// same content when the file has no id) are stored as DUPLICATE and never
// counted twice. Single-customer and multi-customer (bulk) files are handled
// identically.

export type CdrUploadResult = {
  batchId: string;
  status: "COMPLETED" | "FAILED";
  format: "RATED_CDR" | "GENERIC";
  totalRows: number;
  matchedRows: number;
  unmatchedRows: number;
  duplicateRows: number;
  skippedRows: number;
  periodsUpdated: number;
  distinctCustomerCodes: number;
  duplicateOfBatch: { id: string; fileName: string } | null;
  errorLog: string[];
};

function dominantPeriod(rows: ParsedCdrRow[]): string {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.period, (counts.get(r.period) ?? 0) + 1);
  let best = "";
  let bestCount = 0;
  for (const [period, count] of counts) {
    if (count > bestCount) {
      best = period;
      bestCount = count;
    }
  }
  return best;
}

/** Fills empty profile snapshot fields on a customer from their most recent allocated CDR row. */
async function refreshCustomerSnapshots(matchedRows: MatchedCdrRow[]) {
  const latestByCustomer = new Map<string, MatchedCdrRow>();
  for (const row of matchedRows) {
    const existing = latestByCustomer.get(row.customerId);
    if (!existing || (row.startCdr && existing.startCdr && row.startCdr > existing.startCdr)) {
      latestByCustomer.set(row.customerId, row);
    }
  }

  const { User } = await import("@/models/User");
  for (const [customerId, row] of latestByCustomer) {
    const customer = await User.findById(customerId);
    if (!customer) continue;

    let changed = false;
    const maybeSet = (field: "iccid" | "imei" | "service" | "cardName" | "vendor", value: string) => {
      if (!customer[field] && value) {
        customer[field] = value;
        changed = true;
      }
    };
    maybeSet("iccid", row.iccid);
    maybeSet("imei", row.imei);
    maybeSet("service", row.service);
    maybeSet("cardName", row.cardName);
    maybeSet("vendor", row.vendor);

    const network = customer.network;
    const fill = (field: "originNumber" | "originCountry" | "originIpAddress" | "originRegion" | "destinationNumber" | "destinationCountry", value: string) => {
      if (network && !network[field] && value) {
        network[field] = value;
        changed = true;
      }
    };
    fill("originNumber", row.originNumber);
    fill("originCountry", row.originCountry);
    fill("originIpAddress", row.originIpAddress);
    fill("originRegion", row.originRegion);
    fill("destinationNumber", row.destinationNumber);
    fill("destinationCountry", row.destinationCountry);

    if (changed) await customer.save();
  }
}

function recordFields(row: ParsedCdrRow) {
  return {
    prod: row.prod,
    startCdr: row.startCdr,
    customerCode: row.customerCode,
    iccid: row.iccid,
    imei: row.imei,
    service: row.service,
    cardName: row.cardName,
    vendor: row.vendor,
    destinationNumber: row.destinationNumber,
    destinationNetwork: row.destinationNetwork,
    destinationCountry: row.destinationCountry,
    destinationState: row.destinationState,
    originNumber: row.originNumber,
    originCountry: row.originCountry,
    originIpAddress: row.originIpAddress,
    originRegion: row.originRegion,
    originState: row.originState,
    volumeDataBytes: row.volumeDataBytes,
    volumeMin: row.volumeMin,
    volumeMsg: row.volumeMsg,
    volumeInBundleBytes: row.volumeInBundleBytes,
    volumeOutBundleBytes: row.volumeOutBundleBytes,
    volumeTotalBytes: row.volumeTotalBytes,
    consumptionMoney: row.consumptionMoney,
    consumptionDataBytes: row.consumptionDataBytes,
    consumptionMin: row.consumptionMin,
    consumptionMsg: row.consumptionMsg,
    priceCurrency: row.priceCurrency,
    priceTotal: row.priceTotal,
    priceInBundle: row.priceInBundle,
    priceInvoiced: row.priceInvoiced,
    period: row.period,
    isFinal: row.isFinal,
  };
}

export async function findDuplicateUpload(buffer: Buffer): Promise<{ id: string; fileName: string } | null> {
  await connectDB();
  const existing = await CdrBatch.findOne({ fileHash: hashBuffer(buffer), status: "COMPLETED" }).sort({ createdAt: -1 }).lean();
  return existing ? { id: existing._id.toString(), fileName: existing.fileName } : null;
}

export async function processCdrUpload(params: {
  buffer: Buffer;
  fileName: string;
  uploadMode: CdrUploadMode;
  uploadedBy: string;
}): Promise<CdrUploadResult> {
  const startedAt = Date.now();
  await connectDB();

  const fileHash = hashBuffer(params.buffer);
  const duplicateOfBatch = await findDuplicateUpload(params.buffer);

  const batch = await CdrBatch.create({
    fileName: params.fileName,
    uploadedBy: params.uploadedBy,
    uploadMode: params.uploadMode,
    fileHash,
    status: "PROCESSING",
  });
  const batchId = batch._id.toString();
  const errorLog: string[] = [];

  const failed = async (format: CdrUploadResult["format"], totalRows: number, skippedRows: number, messages: string[]) => {
    const log = [...errorLog, ...messages];
    await CdrBatch.findByIdAndUpdate(batch._id, {
      status: "FAILED",
      totalRows,
      skippedRows,
      errorLog: log,
      processingMs: Date.now() - startedAt,
    });
    return {
      batchId,
      status: "FAILED" as const,
      format,
      totalRows,
      matchedRows: 0,
      unmatchedRows: 0,
      duplicateRows: 0,
      skippedRows,
      periodsUpdated: 0,
      distinctCustomerCodes: 0,
      duplicateOfBatch,
      errorLog: log,
    };
  };

  try {
    const workbook = XLSX.read(params.buffer, { type: "buffer", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return failed("GENERIC", 0, 0, ["The uploaded file has no readable sheet."]);

    const isRatedCdr = detectRatedCdrFormat(sheet);
    const parseResult = isRatedCdr ? parseRatedCdrSheet(sheet) : parseGenericSheet(sheet);
    errorLog.push(...parseResult.parseErrors);

    if (parseResult.rows.length === 0) {
      return failed(parseResult.format, parseResult.totalDataRows, parseResult.skippedRows, ["No usable data rows were found in this file."]);
    }

    const rows = parseResult.rows;
    const ctx = await buildAllocationContext();
    const keys = computeDedupeKeys(
      rows.map((r) => ({ sourceRecordId: r.cdrId, raw: r as unknown as Record<string, unknown> }))
    );

    // Records already processed by earlier uploads.
    const existingKeys = new Set<string>();
    for (const part of chunk(keys)) {
      const found = await CdrRecord.find({ dedupeKey: { $in: part }, allocationStatus: { $in: ["ALLOCATED", "UNALLOCATED"] } })
        .select("dedupeKey")
        .lean();
      for (const f of found) existingKeys.add(f.dedupeKey);
    }
    // Rows stored before dedupe keys existed only have their Cdr ID.
    const legacyIds = new Set<string>();
    for (const part of chunk(rows.map((r) => r.cdrId).filter(Boolean))) {
      const found = await CdrRecord.find({ cdrId: { $in: part }, dedupeKey: { $in: ["", null] } }).select("cdrId").lean();
      for (const f of found) legacyIds.add(f.cdrId);
    }

    const allocatedRows: MatchedCdrRow[] = [];
    const reasonCounts: Record<string, number> = {};
    let unallocated = 0;
    let duplicates = 0;
    const seenInFile = new Set<string>();

    const docs = rows.map((row, i) => {
      const key = keys[i];
      const base = { cdrBatch: batch._id, dedupeKey: key, ...recordFields(row) };

      if (seenInFile.has(key) || existingKeys.has(key) || (row.cdrId && legacyIds.has(row.cdrId))) {
        duplicates++;
        return {
          ...base,
          // {cdrBatch, cdrId} is unique, so an in-file repeat needs its own id.
          cdrId: seenInFile.has(key) ? `${row.cdrId || key}#dup-${i}` : row.cdrId || key,
          allocationStatus: "DUPLICATE",
          matched: false,
          unallocatedReason: "Duplicate record — already processed.",
        };
      }
      seenInFile.add(key);

      const result = allocateRow(ctx, {
        customerCode: row.customerCode,
        productCode: row.prod,
        iccid: row.iccid,
        cardName: row.cardName,
        requirePricing: false,
      });

      if (result.status === "ALLOCATED") {
        allocatedRows.push({ ...row, customerId: result.account.customerId.toString(), accountId: result.account.id.toString() });
        return {
          ...base,
          cdrId: row.cdrId || key,
          customer: result.account.customerId,
          customerAccount: result.account.id,
          product: result.product.id,
          allocationStatus: "ALLOCATED",
          matched: true,
        };
      }

      unallocated++;
      reasonCounts[result.reasonCode] = (reasonCounts[result.reasonCode] ?? 0) + 1;
      return {
        ...base,
        cdrId: row.cdrId || key,
        customer: result.account?.customerId ?? null,
        customerAccount: result.account?.id ?? null,
        product: result.product?.id ?? null,
        allocationStatus: "UNALLOCATED",
        unallocatedReasonCode: result.reasonCode,
        unallocatedReason: result.reason,
        matched: false,
      };
    });

    for (const part of chunk(docs, 1000)) {
      await CdrRecord.insertMany(part, { ordered: false });
    }

    const periodsUpdated = await upsertUsageRecords(groupByAccountPeriod(allocatedRows), params.uploadMode, batchId, params.uploadedBy);
    await refreshCustomerSnapshots(allocatedRows);

    const distinctCustomerCodes = new Set(rows.map((r) => r.customerCode.trim().toUpperCase()).filter(Boolean)).size;
    const provider = rows[0]?.vendor || (parseResult.format === "RATED_CDR" ? "Starlink" : "Unknown");
    if (duplicateOfBatch) errorLog.push(`This file was already uploaded as "${duplicateOfBatch.fileName}"; its records were detected as duplicates.`);

    await CdrBatch.findByIdAndUpdate(batch._id, {
      status: "COMPLETED",
      provider,
      periodMonth: dominantPeriod(rows),
      totalRows: parseResult.totalDataRows,
      matchedRows: allocatedRows.length,
      unmatchedRows: unallocated,
      duplicateRows: duplicates,
      skippedRows: parseResult.skippedRows,
      distinctCustomerCodes,
      errorLog,
      processingMs: Date.now() - startedAt,
    });

    await ActivityLog.create({
      actor: params.uploadedBy,
      action: "CDR_UPLOAD",
      meta: {
        batchId,
        fileName: params.fileName,
        format: parseResult.format,
        totalRows: parseResult.totalDataRows,
        allocatedRows: allocatedRows.length,
        unallocatedRows: unallocated,
        duplicateRows: duplicates,
        distinctCustomerCodes,
      },
    });

    await notifyUnallocatedRecords({
      pipeline: "RATED",
      batchId,
      fileName: params.fileName,
      uploadedById: params.uploadedBy,
      totalRows: rows.length,
      allocatedRows: allocatedRows.length,
      unallocatedRows: unallocated,
      reasonCounts,
    });

    return {
      batchId,
      status: "COMPLETED",
      format: parseResult.format,
      totalRows: parseResult.totalDataRows,
      matchedRows: allocatedRows.length,
      unmatchedRows: unallocated,
      duplicateRows: duplicates,
      skippedRows: parseResult.skippedRows,
      periodsUpdated,
      distinctCustomerCodes,
      duplicateOfBatch,
      errorLog,
    };
  } catch (err) {
    console.error(`[cdr-upload] batch ${batchId} failed`, err);
    return failed("GENERIC", 0, 0, [err instanceof Error ? err.message : "Unknown error while processing the file."]);
  }
}

/**
 * Re-runs allocation for a batch's UNALLOCATED rows (after the admin adds the
 * missing Customer Account / Product Code), or allocates selected rows to an
 * account the admin chose manually. Newly allocated rows are ADDED to monthly
 * usage — never replacing it, since they are only part of the file.
 */
export async function reprocessUnallocatedCdrRecords(
  batchId: string,
  adminId: string,
  options?: { recordIds?: string[]; forcedAccountId?: string }
): Promise<{ reAllocated: number; stillUnallocated: number }> {
  await connectDB();
  if (!mongoose.isValidObjectId(batchId)) return { reAllocated: 0, stillUnallocated: 0 };

  const filter: Record<string, unknown> = { cdrBatch: batchId, allocationStatus: "UNALLOCATED" };
  if (options?.recordIds) filter._id = { $in: options.recordIds.filter((id) => mongoose.isValidObjectId(id)) };
  const records = await CdrRecord.find(filter).lean();
  if (records.length === 0) return { reAllocated: 0, stillUnallocated: 0 };

  const ctx = await buildAllocationContext();
  let forcedAccount: AccountRef | null = null;
  if (options?.forcedAccountId) {
    forcedAccount = Array.from(ctx.accountsByNumber.values()).find((a) => a.id.toString() === options.forcedAccountId) ?? null;
    if (!forcedAccount) return { reAllocated: 0, stillUnallocated: records.length };
  }

  const nowAllocated: MatchedCdrRow[] = [];
  const ops = records.map((record) => {
    const result = allocateRow(ctx, {
      customerCode: record.customerCode ?? "",
      productCode: record.prod ?? "",
      iccid: record.iccid ?? "",
      cardName: record.cardName ?? "",
      requirePricing: false,
      forcedAccount,
    });
    if (result.status === "ALLOCATED") {
      nowAllocated.push({
        ...(record as unknown as ParsedCdrRow),
        customerId: result.account.customerId.toString(),
        accountId: result.account.id.toString(),
      });
      return {
        updateOne: {
          filter: { _id: record._id, allocationStatus: "UNALLOCATED" },
          update: {
            $set: {
              customer: result.account.customerId,
              customerAccount: result.account.id,
              product: result.product.id,
              allocationStatus: "ALLOCATED",
              matched: true,
              unallocatedReasonCode: null,
              unallocatedReason: "",
              resolvedAt: new Date(),
              resolvedBy: adminId,
            },
          },
        },
      };
    }
    return {
      updateOne: {
        filter: { _id: record._id },
        update: {
          $set: {
            customer: result.account?.customerId ?? null,
            customerAccount: result.account?.id ?? null,
            product: result.product?.id ?? null,
            unallocatedReasonCode: result.reasonCode,
            unallocatedReason: result.reason,
          },
        },
      },
    };
  });

  type RecordWrite = Parameters<typeof CdrRecord.bulkWrite>[0][number];
  for (const part of chunk(ops as unknown as RecordWrite[], 500)) await CdrRecord.bulkWrite(part, { ordered: false });
  if (nowAllocated.length > 0) {
    await upsertUsageRecords(groupByAccountPeriod(nowAllocated), "ACCUMULATE", batchId, adminId);
  }

  const [allocatedCount, unallocatedCount] = await Promise.all([
    CdrRecord.countDocuments({ cdrBatch: batchId, allocationStatus: "ALLOCATED" }),
    CdrRecord.countDocuments({ cdrBatch: batchId, allocationStatus: "UNALLOCATED" }),
  ]);
  await CdrBatch.findByIdAndUpdate(batchId, { matchedRows: allocatedCount, unmatchedRows: unallocatedCount });

  return { reAllocated: nowAllocated.length, stillUnallocated: records.length - nowAllocated.length };
}
