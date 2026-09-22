export type CdrBatchRow = {
  id: string;
  fileName: string;
  uploadedByName: string;
  provider: string;
  periodMonth: string;
  uploadMode: "REPLACE" | "ACCUMULATE";
  totalRows: number;
  /** Allocated rows (Customer Account + Product Code valid). */
  matchedRows: number;
  /** Unallocated rows. */
  unmatchedRows: number;
  duplicateRows: number;
  skippedRows: number;
  distinctCustomerCodes: number;
  alertAcknowledged: boolean;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  errorLog: string[];
  createdAt: string;
};

export type UnmatchedCdrRow = {
  id: string;
  cdrId: string;
  customerCode: string;
  productCode: string;
  reasonLabel: string;
  reason: string;
  startCdr: string | null;
  iccid: string;
  cardName: string;
  service: string;
  vendor: string;
  period: string;
  volumeDataGB: number;
  volumeTotalGB: number;
  priceTotal: number;
  currency: string;
};
