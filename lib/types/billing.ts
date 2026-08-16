export type InvoiceListRow = {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  cardName: string;
  vendor: string;
  planName: string;
  usageGB: number;
  periodMonth: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  total: number;
  currency: string;
  status: "DRAFT" | "SENT" | "DUE" | "OVERDUE" | "PAID" | "CANCELLED";
};

export type InvoiceLineItemDetail = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
  // Present only on line items generated from a priced CDR charge record —
  // admin-only audit trail, never shown on customer-facing views/PDF.
  cdrIdentifier?: string;
  wholesaleAmount?: number | null;
  retailPlanName?: string;
  pricingMethod?: string;
  markupPercent?: number | null;
  fixedPrice?: number | null;
};

export type InvoiceDetail = InvoiceListRow & {
  customerEmail: string;
  lineItems: InvoiceLineItemDetail[];
  taxLabel: string;
  taxRate: number;
  taxAmount: number;
  paidDate: string | null;
  paymentMethod: string;
  sentAt: string | null;
};

export type TrashedInvoiceRow = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerCode: string;
  total: number;
  currency: string;
  status: InvoiceListRow["status"];
  deletedAt: string;
};

export type BillableCustomerOption = {
  id: string;
  label: string;
  customerCode: string;
  customerSince: string;
  planId: string;
  planName: string;
  planProvider: string;
  planSpecLabel: string;
  planMonthlyPrice: number;
  planCurrency: string;
};

export type BillingStats = {
  billedThisCycle: number;
  billedTrendPct: number;
  collected: number;
  collectionRate: number;
  pendingReviewAmount: number;
  pendingReviewCount: number;
  overdueAmount: number;
  overdueCount: number;
  cycleLabel: string;
  cycleDaysLeft: number;
};
