export type InvoiceListRow = {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  periodMonth: string;
  issueDate: string;
  dueDate: string;
  total: number;
  currency: string;
  status: "DRAFT" | "SENT" | "DUE" | "OVERDUE" | "PAID" | "CANCELLED";
};

export type InvoiceDetail = InvoiceListRow & {
  customerEmail: string;
  lineItems: { description: string; quantity: number; unit: string; unitPrice: number; amount: number }[];
  subtotal: number;
  taxLabel: string;
  taxRate: number;
  taxAmount: number;
  paidDate: string | null;
  paymentMethod: string;
  sentAt: string | null;
};

export type BillableCustomerOption = {
  id: string;
  label: string;
  planId: string;
};
