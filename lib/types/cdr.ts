export type CdrBatchRow = {
  id: string;
  fileName: string;
  uploadedByName: string;
  provider: string;
  periodMonth: string;
  uploadMode: "REPLACE" | "ACCUMULATE";
  totalRows: number;
  matchedRows: number;
  unmatchedRows: number;
  skippedRows: number;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  errorLog: string[];
  createdAt: string;
};

export type UnmatchedCdrRow = {
  id: string;
  cdrId: string;
  customerCode: string;
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
