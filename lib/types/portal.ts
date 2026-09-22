// Data the customer portal renders. Every value is scoped to ONE Customer
// Account (see lib/accounts/access.ts). Source labels:
//   "SLASH"    — live from the SLASH / Starlink API
//   "DATABASE" — Hybrid Networks records (subscriptions, invoices, CDR usage)

export type PortalAccountOption = {
  id: string;
  accountNumber: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED" | "CLOSED";
};

/** Hybrid Networks subscription on the account (database). */
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

/** Current-cycle usage for one service line (SLASH data-usage/current). */
export type PortalServiceLineUsage = {
  priorityGB: number;
  standardGB: number;
  optInPriorityGB: number;
  nonBillableGB: number;
  totalGB: number;
  billingCycleStart: string;
  billingCycleEnd: string;
  lastUpdatedAt: string | null;
};

/**
 * Starlink service-line plan (SLASH service-plan). Price is deliberately not
 * included: SLASH returns the wholesale price, which is not the customer's.
 */
export type PortalServiceLinePlan = {
  vesselId: string;
  serviceLineNumber: string;
  displayName: string;
  serviceLineActive: boolean | null;
  planName: string | null;
  allocatedDataGB: number | null;
  priorityDataGB: number | null;
  standardDataGB: number | null;
  blockDataGB: number | null;
  topUpDataGB: number | null;
  isOptedIntoOverage: boolean | null;
  overageName: string | null;
  autoRenew: boolean | null;
  billingCycleStart: string | null;
  billingCycleEnd: string | null;
  currentActivationDate: string | null;
  subscriptionEndDate: string | null;
  usage: PortalServiceLineUsage | null;
  /** Set when SLASH could not be reached for this service line. */
  error: string | null;
};

/** CDR-derived usage for one month (database). */
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
  accountNumber: string;
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

/** One terminal on the Overview's connection-status list. */
export type PortalTerminalStatusRow = {
  id: string;
  name: string;
  serialNumber: string;
  onlineStatus: "ONLINE" | "OFFLINE" | "UNKNOWN";
  statusReason: string;
  lastSeenAt: string | null;
};

export type PortalTerminalSummary = {
  totalCount: number;
  activeCount: number;
  /** Average live downlink across online terminals; null when not reported. */
  avgThroughputMbps: number | null;
  terminals: PortalTerminalStatusRow[];
};

export type PortalUsageHistoryRow = {
  periodMonth: string;
  volumeDataGB: number;
  volumeMin: number;
};

/** One day of SLASH data-usage/history, summed across the account's service lines. */
export type PortalDailyUsageRow = {
  date: string;
  priorityGB: number;
  standardGB: number;
  nonBillableGB: number;
  totalGB: number;
};

/** What the Pay Now dialog shows — everything comes from the selected invoice + Settings. */
export type PortalPaymentInfo = {
  invoiceId: string;
  invoiceNumber: string;
  accountNumber: string;
  periodMonth: string;
  dueDate: string;
  status: PortalInvoiceRow["status"];
  total: number;
  currency: string;
  /** All outstanding (due / overdue) bills on this account. */
  outstandingTotal: number;
  outstandingCount: number;
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  paymentInstructions: string;
};
