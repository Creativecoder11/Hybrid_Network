"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Send, CheckCircle2, XCircle, Download } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { MarkPaidModal } from "@/components/admin/MarkPaidModal";
import { sendInvoiceAction, cancelInvoiceAction, markPaidAction } from "@/lib/actions/invoices";
import { formatCurrency, formatDate, formatDateTime, formatPeriodMonth } from "@/lib/utils/format";
import type { InvoiceDetail } from "@/lib/types/billing";

const STATUS_TONE: Record<InvoiceDetail["status"], "green" | "amber" | "red" | "neutral"> = {
  DRAFT: "neutral",
  SENT: "amber",
  DUE: "amber",
  OVERDUE: "red",
  PAID: "green",
  CANCELLED: "neutral",
};

export function InvoiceDetailClient({ invoice }: { invoice: InvoiceDetail }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);

  async function handleSend() {
    setPending("send");
    const result = await sendInvoiceAction(invoice.id);
    setPending(null);
    if (result?.error) toast.error(result.error);
    else {
      toast.success(result?.success ?? "Invoice sent.");
      router.refresh();
    }
  }

  async function handleCancel() {
    if (!confirm("Cancel this invoice?")) return;
    setPending("cancel");
    const result = await cancelInvoiceAction(invoice.id);
    setPending(null);
    if (result?.error) toast.error(result.error);
    else {
      toast.success(result?.success ?? "Invoice cancelled.");
      router.refresh();
    }
  }

  async function handleMarkPaid(paymentMethod: string, paidDate: string) {
    const fd = new FormData();
    fd.set("invoiceId", invoice.id);
    fd.set("paymentMethod", paymentMethod);
    fd.set("paidDate", paidDate);
    const result = await markPaidAction(undefined, fd);
    if (!result?.error) router.refresh();
    return result;
  }

  return (
    <div className="max-w-full space-y-6">
      <Link
        href="/admin/billing"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-primary"
      >
        <ArrowLeft className="size-3.5" />
        Back to Billing
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <p className="text-xl font-bold text-text-primary">{invoice.invoiceNumber}</p>
            <Badge tone={STATUS_TONE[invoice.status]}>{invoice.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            <Link href={`/admin/customers/${invoice.customerId}`} className="text-accent-blue hover:underline">
              {invoice.customerName}
            </Link>{" "}
            {invoice.customerCode && `(${invoice.customerCode})`} · {invoice.customerEmail} ·{" "}
            {formatPeriodMonth(invoice.periodMonth)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
            <Button variant="outline">
              <Download className="size-4" />
              PDF
            </Button>
          </a>
          {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
            <>
              <Button onClick={handleSend} loading={pending === "send"}>
                <Send className="size-4" />
                {invoice.sentAt ? "Resend" : "Send"} Invoice
              </Button>
              <Button variant="secondary" onClick={() => setMarkPaidOpen(true)}>
                <CheckCircle2 className="size-4" />
                Mark Paid
              </Button>
              <Button variant="danger" onClick={handleCancel} loading={pending === "cancel"}>
                <XCircle className="size-4" />
                Cancel
              </Button>
            </>
          )}
        </div>
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
          <p className="text-xs text-text-muted">{invoice.paidDate ? "Paid Date" : "Sent At"}</p>
          <p className="mt-1 text-sm font-medium text-text-primary">
            {invoice.paidDate
              ? `${formatDate(invoice.paidDate)} · ${invoice.paymentMethod}`
              : invoice.sentAt
                ? formatDateTime(invoice.sentAt)
                : "--"}
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
                <TD className="text-text-primary">
                  <p>{li.description}</p>
                  {li.cdrIdentifier && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                      <span className="font-mono">
                        CDR: <span className="text-text-secondary">{li.cdrIdentifier}</span>
                      </span>
                      {li.wholesaleAmount !== null && li.wholesaleAmount !== undefined && (
                        <span>
                          Wholesale:{" "}
                          <span className="text-text-secondary">
                            {formatCurrency(li.wholesaleAmount, invoice.currency)}
                          </span>
                        </span>
                      )}
                      {li.retailPlanName && (
                        <span>
                          Plan: <span className="text-text-secondary">{li.retailPlanName}</span>
                        </span>
                      )}
                      {li.pricingMethod && (
                        <span>
                          Pricing:{" "}
                          <span className="text-text-secondary">
                            {li.pricingMethod === "PERCENTAGE_MARKUP"
                              ? `${li.markupPercent}% markup`
                              : `${formatCurrency(li.fixedPrice, invoice.currency)} fixed`}
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                </TD>
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

      {markPaidOpen && (
        <MarkPaidModal
          title="Mark invoice as paid"
          onClose={() => setMarkPaidOpen(false)}
          onConfirm={handleMarkPaid}
        />
      )}
    </div>
  );
}
