import "server-only";
import { connectDB } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import { User } from "@/models/User";
import { Settings } from "@/models/Settings";
import { UsageRecord } from "@/models/UsageRecord";
import { formatDate } from "@/lib/utils/format";
import type { InvoicePdfData } from "@/lib/pdf/InvoiceDocument";

const GB = 1_000_000_000;

export async function buildInvoicePdfData(invoiceId: string): Promise<InvoicePdfData | null> {
  await connectDB();

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return null;

  const [customer, settings, usage] = await Promise.all([
    User.findById(invoice.customer),
    Settings.findOne({ key: "GLOBAL" }),
    UsageRecord.findOne({ customer: invoice.customer, periodMonth: invoice.periodMonth }),
  ]);
  if (!customer) return null;

  return {
    invoiceNumber: invoice.invoiceNumber,
    issueDate: formatDate(invoice.issueDate),
    dueDate: formatDate(invoice.dueDate),
    status: invoice.status,
    customer: {
      name: customer.name,
      customerId: customer.customerId ?? "",
      email: customer.email,
      address: customer.address || "--",
      company: customer.company || "",
    },
    company: {
      name: settings?.companyName ?? "Hybrid Networks",
      address: settings?.companyAddress ?? "",
      email: settings?.companyEmail ?? "billing@hybridnetworks.com",
      phone: settings?.companyPhone ?? "",
    },
    lineItems: invoice.lineItems.map((li) => ({
      description: li.description,
      quantity: li.quantity ?? 0,
      unit: li.unit ?? "",
      unitPrice: li.unitPrice ?? 0,
      amount: li.amount ?? 0,
    })),
    subtotal: invoice.subtotal,
    taxLabel: invoice.taxLabel ?? "GST",
    taxRate: invoice.taxRate,
    taxAmount: invoice.taxAmount,
    total: invoice.total,
    currency: invoice.currency ?? "MYR",
    usageSummary: usage
      ? {
          dataGB: Math.round(((usage.volumeDataBytes ?? 0) / GB) * 100) / 100,
          voiceMin: usage.volumeMin ?? 0,
          sms: usage.volumeMsg ?? 0,
        }
      : null,
    paymentMethod: invoice.paymentMethod || undefined,
    paidDate: invoice.paidDate ? formatDate(invoice.paidDate) : null,
  };
}
