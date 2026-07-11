import { UsageRecord } from "@/models/UsageRecord";
import type { ParsedCdrRow } from "./types";
import type { CdrUploadMode } from "@/models/CdrBatch";

export type MatchedCdrRow = ParsedCdrRow & { customerId: string };

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
    currency: "MYR",
  };
}

/** Groups matched rows by (customer, period) and sums every volume/consumption/price field. */
export function groupByCustomerPeriod(rows: MatchedCdrRow[]): Map<string, { customerId: string; period: string; totals: PeriodTotals }> {
  const groups = new Map<string, { customerId: string; period: string; totals: PeriodTotals }>();

  for (const row of rows) {
    const key = `${row.customerId}|${row.period}`;
    let group = groups.get(key);
    if (!group) {
      group = { customerId: row.customerId, period: row.period, totals: emptyTotals() };
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

export async function upsertUsageRecords(
  groups: Map<string, { customerId: string; period: string; totals: PeriodTotals }>,
  mode: CdrUploadMode,
  batchId: string,
  adminId: string
): Promise<number> {
  let updated = 0;

  for (const { customerId, period, totals } of groups.values()) {
    const existing = await UsageRecord.findOne({ customer: customerId, periodMonth: period });
    const hadManual = existing?.source === "MANUAL" || existing?.source === "CDR+MANUAL";
    const source = hadManual ? "CDR+MANUAL" : "CDR";

    if (mode === "REPLACE") {
      await UsageRecord.findOneAndUpdate(
        { customer: customerId, periodMonth: period },
        {
          $set: {
            ...totals,
            source,
            cdrBatch: batchId,
            lastUpdatedBy: adminId,
          },
        },
        { upsert: true, setDefaultsOnInsert: true }
      );
    } else {
      await UsageRecord.findOneAndUpdate(
        { customer: customerId, periodMonth: period },
        {
          $inc: {
            volumeDataBytes: totals.volumeDataBytes,
            volumeMin: totals.volumeMin,
            volumeMsg: totals.volumeMsg,
            volumeInBundleBytes: totals.volumeInBundleBytes,
            volumeOutBundleBytes: totals.volumeOutBundleBytes,
            volumeTotalBytes: totals.volumeTotalBytes,
            consumptionMoney: totals.consumptionMoney,
            consumptionDataBytes: totals.consumptionDataBytes,
            consumptionMin: totals.consumptionMin,
            consumptionMsg: totals.consumptionMsg,
            cdrPriceTotal: totals.cdrPriceTotal,
            cdrPriceInvoiced: totals.cdrPriceInvoiced,
          },
          $set: { source, currency: totals.currency, cdrBatch: batchId, lastUpdatedBy: adminId },
        },
        { upsert: true, setDefaultsOnInsert: true }
      );
    }
    updated++;
  }

  return updated;
}
