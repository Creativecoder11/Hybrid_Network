import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { connectDB } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import { requireRole } from "@/lib/auth/dal";
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

export default async function PortalBillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["CUSTOMER"], "/admin");
  const { id } = await params;

  await connectDB();
  const invoice = await Invoice.findById(id).lean();
  if (!invoice || invoice.customer.toString() !== user.id) notFound();

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
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-text-primary">{invoice.invoiceNumber}</h1>
            <Badge tone={STATUS_TONE[invoice.status]}>{invoice.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-text-muted">{formatPeriodMonth(invoice.periodMonth)}</p>
        </div>
        <a href={`/api/invoices/${invoice._id.toString()}/pdf`} target="_blank" rel="noreferrer">
          <Button variant="outline">
            <Download className="size-4" />
            Download PDF
          </Button>
        </a>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-text-muted">Issue Date</p>
          <p className="mt-1 text-sm font-medium text-text-primary">{formatDate(invoice.issueDate)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-muted">Due Date</p>
          <p className="mt-1 text-sm font-medium text-text-primary">{formatDate(invoice.dueDate)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-muted">{invoice.paidDate ? "Paid Date" : "Total Due"}</p>
          <p className="mt-1 text-sm font-medium text-text-primary">
            {invoice.paidDate ? formatDate(invoice.paidDate) : formatCurrency(invoice.total, invoice.currency)}
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
            <span>Subtotal</span>
            <span>{formatCurrency(invoice.subtotal, invoice.currency)}</span>
          </div>
          <div className="flex justify-between text-sm text-text-secondary">
            <span>
              {invoice.taxLabel} ({invoice.taxRate}%)
            </span>
            <span>{formatCurrency(invoice.taxAmount, invoice.currency)}</span>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold text-text-primary">
            <span>Total</span>
            <span>{formatCurrency(invoice.total, invoice.currency)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
