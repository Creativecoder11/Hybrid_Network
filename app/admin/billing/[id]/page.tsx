import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import { User } from "@/models/User";
import { Subscription } from "@/models/Subscription";
import { UsageRecord } from "@/models/UsageRecord";
import { InvoiceDetailClient } from "@/components/admin/InvoiceDetailClient";
import type { InvoiceDetail } from "@/lib/types/billing";

const GB = 1_000_000_000;

export const metadata: Metadata = {
  title: "Invoice | Hybrid Networks Admin",
};

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connectDB();

  const invoice = await Invoice.findById(id).lean();
  if (!invoice) notFound();

  const [customer, activeSub, usage] = await Promise.all([
    User.findById(invoice.customer).lean(),
    Subscription.findOne({ customer: invoice.customer, status: "ACTIVE" }).populate("plan").lean(),
    UsageRecord.findOne({ customer: invoice.customer, periodMonth: invoice.periodMonth }).lean(),
  ]);

  const planName = (activeSub?.plan as unknown as { name?: string } | null)?.name ?? "--";

  const detail: InvoiceDetail = {
    id: invoice._id.toString(),
    invoiceNumber: invoice.invoiceNumber,
    customerId: customer?._id?.toString() ?? "",
    customerName: customer?.name ?? "Unknown",
    customerCode: customer?.customerCode ?? "",
    customerEmail: customer?.email ?? "",
    vendor: customer?.vendor ?? "--",
    cardName: customer?.cardName ?? "--",
    planName,
    usageGB: Math.round(((usage?.volumeDataBytes ?? 0) / GB) * 100) / 100,
    periodMonth: invoice.periodMonth,
    issueDate: (invoice.issueDate as Date).toISOString(),
    dueDate: (invoice.dueDate as Date).toISOString(),
    total: invoice.total,
    currency: invoice.currency ?? "USD",
    status: invoice.status,
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
    paidDate: invoice.paidDate ? (invoice.paidDate as Date).toISOString() : null,
    paymentMethod: invoice.paymentMethod ?? "",
    sentAt: invoice.sentAt ? (invoice.sentAt as Date).toISOString() : null,
  };

  return <InvoiceDetailClient invoice={detail} />;
}
