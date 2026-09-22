import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { connectDB } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import { User } from "@/models/User";
import { CustomerAccount } from "@/models/CustomerAccount";
import { Settings } from "@/models/Settings";
import { UsageRecord } from "@/models/UsageRecord";
import { formatDate } from "@/lib/utils/format";
import type { InvoicePdfData } from "@/lib/pdf/InvoiceDocument";

// Assembles a tax invoice from the stored invoice + the customer's profile and
// account + company details in Admin -> Settings. Nothing is hardcoded: if a
// company detail (e.g. ABN) hasn't been entered in Settings it is simply
// omitted, and missingCompanyDetails lets the admin UI flag it.

const GB = 1_000_000_000;

let logoCache: Buffer | null | undefined;
async function loadLogo(): Promise<Buffer | null> {
  if (logoCache !== undefined) return logoCache;
  try {
    logoCache = await readFile(path.join(process.cwd(), "public", "assets", "hybrid-logo-invoice.png"));
  } catch {
    logoCache = null;
  }
  return logoCache;
}

function billingPeriodLabel(periodMonth: string): string {
  const year = Number(periodMonth.slice(0, 4));
  const month = Number(periodMonth.slice(4, 6));
  if (!year || !month) return periodMonth;
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

export function missingCompanyDetails(settings: {
  companyLegalName?: string | null;
  companyAbn?: string | null;
  companyAddress?: string | null;
  companyEmail?: string | null;
} | null): string[] {
  const missing: string[] = [];
  if (!settings?.companyLegalName) missing.push("legal company name");
  if (!settings?.companyAbn) missing.push("ABN");
  if (!settings?.companyAddress) missing.push("company address");
  if (!settings?.companyEmail) missing.push("billing email");
  return missing;
}

export async function buildInvoicePdfData(invoiceId: string): Promise<InvoicePdfData | null> {
  await connectDB();

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return null;

  const [customer, account, settings, logo] = await Promise.all([
    User.findById(invoice.customer).lean(),
    invoice.customerAccount ? CustomerAccount.findById(invoice.customerAccount).select("accountNumber name").lean() : null,
    Settings.findOne({ key: "GLOBAL" }).lean(),
    loadLogo(),
  ]);
  if (!customer) return null;

  const accountScope = invoice.customerAccount ? { customerAccount: invoice.customerAccount } : { customer: invoice.customer };
  const [usage, lastInvoices] = await Promise.all([
    UsageRecord.findOne({ ...accountScope, periodMonth: invoice.periodMonth }).lean(),
    Invoice.find({
      ...accountScope,
      _id: { $ne: invoice._id },
      status: { $in: ["SENT", "DUE", "OVERDUE", "PAID"] },
    })
      .sort({ issueDate: -1 })
      .limit(3)
      .lean(),
  ]);

  const isPaid = invoice.status === "PAID";
  return {
    invoiceNumber: invoice.invoiceNumber,
    issueDate: formatDate(invoice.issueDate),
    dueDate: formatDate(invoice.dueDate),
    billingPeriod: billingPeriodLabel(invoice.periodMonth),
    status: invoice.status,
    customer: {
      name: customer.name,
      company: customer.company || "",
      customerId: customer.customerId ?? "",
      accountNumber: invoice.accountNumber || account?.accountNumber || "",
      accountName: account?.name || "",
      email: customer.email,
      phone: customer.phone || "",
      address: customer.address || "",
    },
    company: {
      name: settings?.companyName || "Hybrid Networks",
      legalName: settings?.companyLegalName || settings?.companyName || "Hybrid Networks",
      abn: settings?.companyAbn ?? "",
      address: settings?.companyAddress ?? "",
      email: settings?.companyEmail ?? "",
      phone: settings?.companyPhone ?? "",
      website: settings?.companyWebsite ?? "",
      paymentInstructions: settings?.paymentInstructions ?? "",
    },
    logo,
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
    amountPaid: isPaid ? invoice.total : 0,
    balanceDue: isPaid || invoice.status === "CANCELLED" ? 0 : invoice.total,
    currency: invoice.currency ?? "USD",
    usageSummary: usage
      ? {
          dataGB: Math.round(((usage.volumeDataBytes ?? 0) / GB) * 100) / 100,
          voiceMin: usage.volumeMin ?? 0,
          sms: usage.volumeMsg ?? 0,
        }
      : null,
    paymentMethod: invoice.paymentMethod || undefined,
    paidDate: invoice.paidDate ? formatDate(invoice.paidDate) : null,
    lastInvoices: lastInvoices.reverse().map((inv) => ({ periodMonth: inv.periodMonth, total: inv.total })),
  };
}
