import { UsageRecord } from "@/models/UsageRecord";
import type { ParsedCdrRow } from "./types";
import type { CdrUploadMode } from "@/models/CdrBatch";

export type MatchedCdrRow = ParsedCdrRow & { customerId: string; accountId: string };

type PeriodTotals = {
  volumeDataBytes: number;
  volumeMin: number;
  volumeMsg: number;
  volumeInBundleBytes: number;
  volumeOutBundleBytes: number;
  volumeTotalBytes: number;
  consumptionMoney: number;
  consumptionDataBytes: number;
  consumptionMin: number;
  consumptionMsg: number;
  cdrPriceTotal: number;
  cdrPriceInvoiced: number;
  currency: string;
};

type UsageGroup = { customerId: string; accountId: string; period: string; totals: PeriodTotals };

function emptyTotals(): PeriodTotals {
  return {
    volumeDataBytes: 0,
    volumeMin: 0,
    volumeMsg: 0,
    volumeInBundleBytes: 0,
    volumeOutBundleBytes: 0,
    volumeTotalBytes: 0,
    consumptionMoney: 0,
    consumptionDataBytes: 0,
    consumptionMin: 0,
    consumptionMsg: 0,
    cdrPriceTotal: 0,
    cdrPriceInvoiced: 0,
    currency: "USD",
  };
}

/** Groups allocated rows by (Customer Account, period) and sums every volume/consumption/price field. */
export function groupByAccountPeriod(rows: MatchedCdrRow[]): Map<string, UsageGroup> {
  const groups = new Map<string, UsageGroup>();

  for (const row of rows) {
    const key = `${row.accountId}|${row.period}`;
    let group = groups.get(key);
    if (!group) {
      group = { customerId: row.customerId, accountId: row.accountId, period: row.period, totals: emptyTotals() };
      groups.set(key, group);
    }
    const t = group.totals;
    t.volumeDataBytes += row.volumeDataBytes;
    t.volumeMin += row.volumeMin;
    t.volumeMsg += row.volumeMsg;
    t.volumeInBundleBytes += row.volumeInBundleBytes;
    t.volumeOutBundleBytes += row.volumeOutBundleBytes;
    t.volumeTotalBytes += row.volumeTotalBytes;
    t.consumptionMoney += row.consumptionMoney;
    t.consumptionDataBytes += row.consumptionDataBytes;
    t.consumptionMin += row.consumptionMin;
    t.consumptionMsg += row.consumptionMsg;
    t.cdrPriceTotal += row.priceTotal;
    t.cdrPriceInvoiced += row.priceInvoiced;
    if (row.priceCurrency) t.currency = row.priceCurrency;
  }

  return groups;
}

/**
 * Writes usage per (customer, Customer Account, month). REPLACE overwrites the
 * month with this upload's totals; ACCUMULATE adds them (used for partial
 * uploads and for records allocated later by reprocessing).
 */
export async function upsertUsageRecords(
  groups: Map<string, UsageGroup>,
  mode: CdrUploadMode,
  batchId: string,
  adminId: string
): Promise<number> {
  let updated = 0;

  for (const { customerId, accountId, period, totals } of groups.values()) {
    const filter = { customer: customerId, customerAccount: accountId, periodMonth: period };
    const existing = await UsageRecord.findOne(filter).select("source").lean();
    const hadManual = existing?.source === "MANUAL" || existing?.source === "CDR+MANUAL";
    const source = hadManual ? "CDR+MANUAL" : "CDR";

    if (mode === "REPLACE") {
      await UsageRecord.findOneAndUpdate(
        filter,
        { $set: { ...totals, source, cdrBatch: batchId, lastUpdatedBy: adminId } },
        { upsert: true, setDefaultsOnInsert: true }
      );
    } else {
      const { currency, ...increments } = totals;
      await UsageRecord.findOneAndUpdate(
        filter,
        { $inc: increments, $set: { source, currency, cdrBatch: batchId, lastUpdatedBy: adminId } },
        { upsert: true, setDefaultsOnInsert: true }
      );
    }
    updated++;
  }

  return updated;
}
