export type RevenuePoint = { month: string; revenue: number };

export type TopCustomerRow = {
  id: string;
  name: string;
  customerCode: string;
  planName: string;
  total: number;
  currency: string;
};

export type OutstandingBillRow = {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  planName: string;
  vendor: string;
  cardName: string;
  periodMonth: string;
  usageGB: number;
  total: number;
  currency: string;
  status: "DUE" | "OVERDUE";
};

export type PlanRevenueRow = { planName: string; total: number; currency: string };

export type UsageTypeRevenueRow = { label: string; total: number };

export type AdminDashboardStats = {
  monthlyRevenue: number;
  monthlyRevenuePrevMonth: number;
  outstandingCount: number;
  outstandingAmount: number;
  totalCustomers: number;
  totalCustomersPrevMonth: number;
  activeCustomers: number;
  activeRate: number;
  billingCycleDaysLeft: number;
  lastCdrBatch: { fileName: string; status: string; createdAt: string; matchedRows: number } | null;
  revenueSeries: RevenuePoint[];
  topCustomers: TopCustomerRow[];
  outstandingBills: OutstandingBillRow[];
  revenueByPlan: PlanRevenueRow[];
  revenueByUsageType: UsageTypeRevenueRow[];
};
