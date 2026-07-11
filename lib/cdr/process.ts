import "server-only";
import * as XLSX from "xlsx";
import { connectDB } from "@/lib/db/connect";
import { CdrBatch, type CdrUploadMode } from "@/models/CdrBatch";
import { CdrRecord } from "@/models/CdrRecord";
import { ActivityLog } from "@/models/ActivityLog";
import { detectRatedCdrFormat, parseRatedCdrSheet } from "./ratedCdrParser";
import { parseGenericSheet } from "./genericParser";
import { buildCustomerMatchMaps, matchCustomer } from "./matcher";
import { groupByCustomerPeriod, upsertUsageRecords, type MatchedCdrRow } from "./aggregator";
import type { ParsedCdrRow } from "./types";

export type CdrUploadResult = {
  batchId: string;
  status: "COMPLETED" | "FAILED";
  format: "RATED_CDR" | "GENERIC";
  totalRows: number;
  matchedRows: number;
  unmatchedRows: number;
  skippedRows: number;
  periodsUpdated: number;
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

/** Fills empty profile snapshot fields on a customer from their most recent matched CDR row. */
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

    if (!customer.network?.originNumber && row.originNumber) {
      customer.network.originNumber = row.originNumber;
      changed = true;
    }
    if (!customer.network?.originCountry && row.originCountry) {
      customer.network.originCountry = row.originCountry;
      changed = true;
    }
    if (!customer.network?.originIpAddress && row.originIpAddress) {
      customer.network.originIpAddress = row.originIpAddress;
      changed = true;
    }
    if (!customer.network?.originRegion && row.originRegion) {
      customer.network.originRegion = row.originRegion;
      changed = true;
    }
    if (!customer.network?.destinationNumber && row.destinationNumber) {
      customer.network.destinationNumber = row.destinationNumber;
      changed = true;
    }
    if (!customer.network?.destinationCountry && row.destinationCountry) {
      customer.network.destinationCountry = row.destinationCountry;
      changed = true;
    }

    if (changed) await customer.save();
  }
}

export async function processCdrUpload(params: {
  buffer: Buffer;
  fileName: string;
  uploadMode: CdrUploadMode;
  uploadedBy: string;
}): Promise<CdrUploadResult> {
  await connectDB();

  const batch = await CdrBatch.create({
    fileName: params.fileName,
    uploadedBy: params.uploadedBy,
    uploadMode: params.uploadMode,
    status: "PROCESSING",
  });

  const errorLog: string[] = [];

  try {
    const workbook = XLSX.read(params.buffer, { type: "buffer", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error("The uploaded file has no readable sheet.");

    const isRatedCdr = detectRatedCdrFormat(sheet);
    const parseResult = isRatedCdr ? parseRatedCdrSheet(sheet) : parseGenericSheet(sheet);
    errorLog.push(...parseResult.parseErrors);

    if (parseResult.rows.length === 0) {
      await CdrBatch.findByIdAndUpdate(batch._id, {
        status: "FAILED",
        provider: parseResult.format === "RATED_CDR" ? "Starlink" : "Unknown",
        totalRows: parseResult.totalDataRows,
        skippedRows: parseResult.skippedRows,
        errorLog: [...errorLog, "No usable data rows were found in this file."],
      });
      return {
        batchId: batch._id.toString(),
        status: "FAILED",
        format: parseResult.format,
        totalRows: parseResult.totalDataRows,
        matchedRows: 0,
        unmatchedRows: 0,
        skippedRows: parseResult.skippedRows,
        periodsUpdated: 0,
        errorLog: [...errorLog, "No usable data rows were found in this file."],
      };
    }

    const matchMaps = await buildCustomerMatchMaps();

    const matchedRows: MatchedCdrRow[] = [];
    const cdrRecordDocs: Record<string, unknown>[] = [];

    for (const row of parseResult.rows) {
      const customer = matchCustomer(matchMaps, row);
      if (customer) {
        matchedRows.push({ ...row, customerId: customer._id.toString() });
      }

      cdrRecordDocs.push({
        cdrBatch: batch._id,
        customer: customer?._id ?? null,
        cdrId: row.cdrId,
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
        matched: Boolean(customer),
      });
    }

    if (cdrRecordDocs.length > 0) {
      await CdrRecord.insertMany(cdrRecordDocs, { ordered: false });
    }

    const groups = groupByCustomerPeriod(matchedRows);
    const periodsUpdated = await upsertUsageRecords(
      groups,
      params.uploadMode,
      batch._id.toString(),
      params.uploadedBy
    );

    await refreshCustomerSnapshots(matchedRows);

    const unmatchedCount = parseResult.rows.length - matchedRows.length;
    const provider = parseResult.rows[0]?.vendor || (parseResult.format === "RATED_CDR" ? "Starlink" : "Unknown");

    await CdrBatch.findByIdAndUpdate(batch._id, {
      status: "COMPLETED",
      provider,
      periodMonth: dominantPeriod(parseResult.rows),
      totalRows: parseResult.totalDataRows,
      matchedRows: matchedRows.length,
      unmatchedRows: unmatchedCount,
      skippedRows: parseResult.skippedRows,
      errorLog,
    });

    await ActivityLog.create({
      actor: params.uploadedBy,
      action: "CDR_UPLOAD",
      meta: {
        batchId: batch._id.toString(),
        fileName: params.fileName,
        format: parseResult.format,
        totalRows: parseResult.totalDataRows,
        matchedRows: matchedRows.length,
        unmatchedRows: unmatchedCount,
      },
    });

    return {
      batchId: batch._id.toString(),
      status: "COMPLETED",
      format: parseResult.format,
      totalRows: parseResult.totalDataRows,
      matchedRows: matchedRows.length,
      unmatchedRows: unmatchedCount,
      skippedRows: parseResult.skippedRows,
      periodsUpdated,
      errorLog,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error while processing the file.";
    await CdrBatch.findByIdAndUpdate(batch._id, {
      status: "FAILED",
      errorLog: [...errorLog, message],
    });
    return {
      batchId: batch._id.toString(),
      status: "FAILED",
      format: "RATED_CDR",
      totalRows: 0,
      matchedRows: 0,
      unmatchedRows: 0,
      skippedRows: 0,
      periodsUpdated: 0,
      errorLog: [...errorLog, message],
    };
  }
}
