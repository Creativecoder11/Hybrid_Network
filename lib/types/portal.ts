export type PortalPlanInfo = {
  planName: string;
  provider: string;
  monthlyPrice: number;
  currency: string;
  dataAllowanceGB: number | null;
  voiceMinutes: number | null;
  smsCount: number | null;
  speedMbps: number | null;
  sharedRatio: string;
  staticIp: string;
  subscriptionStatus: "ACTIVE" | "PAUSED" | "CANCELLED";
  startDate: string;
  terminalIds: string[];
};

export type PortalUsageInfo = {
  periodMonth: string;
  volumeDataGB: number;
  volumeMin: number;
  volumeMsg: number;
  volumeInBundleGB: number;
  dailyAverageGB: number;
};

export type PortalInvoiceRow = {
  id: string;
  invoiceNumber: string;
  periodMonth: string;
  issueDate: string;
  dueDate: string;
  total: number;
  currency: string;
  status: "DRAFT" | "SENT" | "DUE" | "OVERDUE" | "PAID" | "CANCELLED";
};

export type PortalActivityRow = {
  id: string;
  action: string;
  meta: Record<string, unknown>;
  createdAt: string;
};

export type PortalUsageHistoryRow = {
  periodMonth: string;
  volumeDataGB: number;
  volumeMin: number;
};
