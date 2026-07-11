export type ParsedCdrRow = {
  customerCode: string;
  prod: string;
  startCdr: Date | null;
  iccid: string;
  destinationNumber: string;
  destinationNetwork: string;
  destinationCountry: string;
  destinationState: string;
  imei: string;
  service: string;
  cardName: string;
  originNumber: string;
  originCountry: string;
  originIpAddress: string;
  originRegion: string;
  originState: string;

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

  priceCurrency: string;
  priceTotal: number;
  priceInBundle: number;
  priceInvoiced: number;

  period: string; // "YYYYMM"
  cdrId: string;
  vendor: string;
  isFinal: boolean;
};

export type ParseResult = {
  format: "RATED_CDR" | "GENERIC";
  rows: ParsedCdrRow[];
  totalDataRows: number;
  skippedRows: number;
  parseErrors: string[];
};
