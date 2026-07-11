export type NetworkInfo = {
  originNumber: string;
  originCountry: string;
  originIpAddress: string;
  originRegion: string;
  originState: string;
  destinationNumber: string;
  destinationNetwork: string;
  destinationCountry: string;
  destinationState: string;
};

export type CustomerRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  company: string;
  customerId: string;
  customerCode: string;
  status: "ACTIVE" | "SUSPENDED" | "INVITED";
  createdAt: string;
  accountType: "BUSINESS_ENTERPRISE" | "INDIVIDUAL" | "GOVERNMENT" | null;
  contactPerson: string;
  nidTradeLicense: string;
  cardName: string;
  iccid: string;
  imei: string;
  service: string;
  vendor: string;
  network: NetworkInfo;
  planId: string;
  planName: string;
  staticIp: string;
  usage: {
    volumeDataGB: number;
    volumeMin: number;
    volumeMsg: number;
    volumeInBundleGB: number;
    volumeOutBundleGB: number;
    volumeTotalGB: number;
    consumptionMoney: number;
    consumptionDataGB: number;
    consumptionMin: number;
    consumptionMsg: number;
  } | null;
};

export type PlanOption = {
  id: string;
  name: string;
  provider: string;
  monthlyPrice: number;
  currency: string;
  sharedRatio: string;
  speedMbps: number | null;
};

export type CustomerStats = {
  total: number;
  active: number;
  activeRate: number;
  overdueCount: number;
  overdueAmount: number;
  suspended: number;
  suspendedRate: number;
};

export type SubscriptionRow = {
  id: string;
  planName: string;
  planProvider: string;
  monthlyPrice: number;
  currency: string;
  status: "ACTIVE" | "PAUSED" | "CANCELLED";
  startDate: string;
  endDate: string | null;
  staticIp: string;
  terminalIds: string[];
};

export type UsageHistoryRow = {
  periodMonth: string;
  volumeDataGB: number;
  volumeMin: number;
  volumeMsg: number;
  volumeInBundleGB: number;
  volumeOutBundleGB: number;
  volumeTotalGB: number;
  consumptionMoney: number;
  consumptionDataGB: number;
  consumptionMin: number;
  consumptionMsg: number;
  source: "CDR" | "MANUAL" | "CDR+MANUAL";
  currency: string;
};

export type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  periodMonth: string;
  issueDate: string;
  dueDate: string;
  total: number;
  currency: string;
  status: "DRAFT" | "SENT" | "DUE" | "OVERDUE" | "PAID" | "CANCELLED";
};

export type CdrRecordRow = {
  id: string;
  cdrId: string;
  startCdr: string | null;
  period: string;
  volumeDataGB: number;
  volumeTotalGB: number;
  cardName: string;
  service: string;
  priceTotal: number;
  currency: string;
};

export type ActivityLogRow = {
  id: string;
  actorName: string;
  action: string;
  meta: Record<string, unknown>;
  createdAt: string;
};

export type CustomerDetail = CustomerRow & {
  subscriptions: SubscriptionRow[];
};
