import "server-only";
import { connectDB } from "@/lib/db/connect";
import { Invoice, type InvoiceStatus } from "@/models/Invoice";
import { Settings } from "@/models/Settings";
import type { PortalInvoiceRow, PortalPaymentInfo } from "@/lib/types/portal";

// Customer-visible billing for one Customer Account. DRAFT invoices are
// internal to Hybrid Networks until sent, so they are never shown to (or
// downloadable by) customers.

export const CUSTOMER_VISIBLE_STATUSES: InvoiceStatus[] = ["SENT", "DUE", "OVERDUE", "PAID", "CANCELLED"];
const OUTSTANDING: InvoiceStatus[] = ["SENT", "DUE", "OVERDUE"];

type InvoiceLean = {
  _id: { toString(): string };
  invoiceNumber: string;
  accountNumber?: string | null;
  periodMonth: string;
  issueDate: Date;
  dueDate: Date;
  total: number;
  currency?: string | null;
  status: InvoiceStatus;
};

export function toInvoiceRow(inv: InvoiceLean, fallbackAccountNumber = ""): PortalInvoiceRow {
  return {
    id: inv._id.toString(),
    invoiceNumber: inv.invoiceNumber,
    accountNumber: inv.accountNumber || fallbackAccountNumber,
    periodMonth: inv.periodMonth,
    issueDate: new Date(inv.issueDate).toISOString(),
    dueDate: new Date(inv.dueDate).toISOString(),
    total: inv.total,
    currency: inv.currency ?? "USD",
    status: inv.status,
  };
}

export async function listAccountInvoices(
  account: { id: string; accountNumber: string },
  options?: { status?: string; limit?: number }
): Promise<PortalInvoiceRow[]> {
  await connectDB();
  const status = CUSTOMER_VISIBLE_STATUSES.find((s) => s === options?.status);
  const query = Invoice.find({ customerAccount: account.id, status: status ?? { $in: CUSTOMER_VISIBLE_STATUSES } }).sort({
    issueDate: -1,
  });
  if (options?.limit) query.limit(options.limit);
  const invoices = (await query.lean()) as unknown as InvoiceLean[];
  return invoices.map((inv) => toInvoiceRow(inv, account.accountNumber));
}

/**
 * The bill Pay Now refers to: the earliest-due outstanding invoice on the
 * account, plus the account's total outstanding and the company's payment
 * instructions from Settings. null when nothing is owed.
 */
export async function getPaymentInfo(account: { id: string; accountNumber: string }): Promise<PortalPaymentInfo | null> {
  await connectDB();
  const [outstanding, settings] = await Promise.all([
    Invoice.find({ customerAccount: account.id, status: { $in: OUTSTANDING } }).sort({ dueDate: 1 }).lean(),
    Settings.findOne({ key: "GLOBAL" }).select("companyName companyLegalName companyEmail companyPhone paymentInstructions").lean(),
  ]);
  if (outstanding.length === 0) return null;
  const next = outstanding[0] as unknown as InvoiceLean;
  const sameCurrency = outstanding.filter((i) => (i.currency ?? "USD") === (next.currency ?? "USD"));

  return {
    invoiceId: next._id.toString(),
    invoiceNumber: next.invoiceNumber,
    accountNumber: next.accountNumber || account.accountNumber,
    periodMonth: next.periodMonth,
    dueDate: new Date(next.dueDate).toISOString(),
    status: next.status,
    total: next.total,
    currency: next.currency ?? "USD",
    outstandingTotal: Math.round(sameCurrency.reduce((sum, i) => sum + (i.total ?? 0), 0) * 100) / 100,
    outstandingCount: outstanding.length,
    companyName: settings?.companyLegalName || settings?.companyName || "Hybrid Networks",
    companyEmail: settings?.companyEmail ?? "",
    companyPhone: settings?.companyPhone ?? "",
    paymentInstructions: settings?.paymentInstructions ?? "",
  };
}
