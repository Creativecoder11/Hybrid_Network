import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { ArrowLeft, Download } from "lucide-react";
import { connectDB } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import { Settings } from "@/models/Settings";
import { getPortalContext, canAccessAccount } from "@/lib/accounts/access";
import { CUSTOMER_VISIBLE_STATUSES } from "@/lib/portal/billing";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { formatCurrency, formatDate, formatPeriodMonth } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "Invoice | Hybrid Networks Portal",
};

const STATUS_TONE: Record<string, "green" | "amber" | "red" | "neutral"> = {
  DRAFT: "neutral",
  SENT: "amber",
  DUE: "amber",
  OVERDUE: "red",
  PAID: "green",
  CANCELLED: "neutral",
};

function periodRange(periodMonth: string): string {
  const year = Number(periodMonth.slice(0, 4));
  const month = Number(periodMonth.slice(4, 6));
  if (!year || !month) return formatPeriodMonth(periodMonth);
  const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `${fmt.format(new Date(Date.UTC(year, month - 1, 1)))} – ${fmt.format(new Date(Date.UTC(year, month, 0)))}`;
}

export default async function PortalBillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getPortalContext();
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  await connectDB();
  const [invoice, settings] = await Promise.all([
    Invoice.findById(id).lean(),
    Settings.findOne({ key: "GLOBAL" }).select("companyName companyLegalName companyAbn").lean(),
  ]);
  // Server-side ownership: the invoice's account must be one of this user's
  // authorized accounts, and drafts are never shown to customers.
  if (
    !invoice ||
    !canAccessAccount(ctx, invoice.customerAccount?.toString()) ||
    !CUSTOMER_VISIBLE_STATUSES.includes(invoice.status)
  ) {
    notFound();
  }

  const amountPaid = invoice.status === "PAID" ? invoice.total : 0;
  const balanceDue = invoice.status === "PAID" || invoice.status === "CANCELLED" ? 0 : invoice.total;

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/portal/bills"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-primary"
      >
        <ArrowLeft className="size-3.5" />
        Back to My Bills
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Tax Invoice</p>
          <div className="flex items-center gap-3">
            <p className="text-xl font-bold text-text-primary">{invoice.invoiceNumber}</p>
            <Badge tone={STATUS_TONE[invoice.status]}>{invoice.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {settings?.companyLegalName || settings?.companyName || "Hybrid Networks"}
            {settings?.companyAbn ? ` · ABN ${settings.companyAbn}` : ""}
          </p>
        </div>
        <a href={`/api/invoices/${invoice._id.toString()}/pdf`} target="_blank" rel="noreferrer">
          <Button variant="outline">
            <Download className="size-4" />
            Download PDF
          </Button>
        </a>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-text-muted">Account No.</p>
          <p className="mt-1 font-mono text-sm font-medium text-text-primary">{invoice.accountNumber || "--"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-muted">Billing Period</p>
          <p className="mt-1 text-sm font-medium text-text-primary">{periodRange(invoice.periodMonth)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-muted">Invoice Date</p>
          <p className="mt-1 text-sm font-medium text-text-primary">{formatDate(invoice.issueDate)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-muted">{invoice.paidDate ? "Paid Date" : "Due Date"}</p>
          <p className="mt-1 text-sm font-medium text-text-primary">
            {formatDate(invoice.paidDate ?? invoice.dueDate)}
          </p>
        </Card>
      </div>

      <TableContainer>
        <Table>
          <THead>
            <TR>
              <TH>Description</TH>
              <TH>Qty</TH>
              <TH>Unit Price</TH>
              <TH className="text-right">Amount</TH>
            </TR>
          </THead>
          <TBody>
            {invoice.lineItems.map((li, i) => (
              <TR key={i}>
                <TD className="text-text-primary">{li.description}</TD>
                <TD>
                  {li.quantity} {li.unit}
                </TD>
                <TD>{formatCurrency(li.unitPrice, invoice.currency)}</TD>
                <TD className="text-right">{formatCurrency(li.amount, invoice.currency)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </TableContainer>

      <div className="flex justify-end">
        <div className="w-full max-w-xs space-y-2">
          <div className="flex justify-between text-sm text-text-secondary">
            <span>Subtotal (excl. {invoice.taxLabel})</span>
            <span>{formatCurrency(invoice.subtotal, invoice.currency)}</span>
          </div>
          <div className="flex justify-between text-sm text-text-secondary">
            <span>
              {invoice.taxLabel} ({invoice.taxRate}%)
            </span>
            <span>{formatCurrency(invoice.taxAmount, invoice.currency)}</span>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold text-text-primary">
            <span>Total (incl. {invoice.taxLabel})</span>
            <span>{formatCurrency(invoice.total, invoice.currency)}</span>
          </div>
          <div className="flex justify-between text-sm text-text-secondary">
            <span>Amount paid</span>
            <span>{formatCurrency(amountPaid, invoice.currency)}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold text-text-primary">
            <span>Balance due</span>
            <span>{formatCurrency(balanceDue, invoice.currency)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
