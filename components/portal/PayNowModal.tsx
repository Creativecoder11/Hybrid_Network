"use client";

import { Mail, Phone, Download } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatDate, formatPeriodMonth } from "@/lib/utils/format";
import type { PortalPaymentInfo } from "@/lib/types/portal";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-right text-sm font-medium text-text-primary">{value}</span>
    </div>
  );
}

// Pay Now shows exactly the bill it refers to (selected account's
// earliest-due unpaid invoice) and the payment instructions configured in
// Admin -> Settings. Online card payment isn't integrated, so this is a
// payment-instructions dialog rather than a checkout.
export function PayNowModal({ payment, onClose }: { payment: PortalPaymentInfo; onClose: () => void }) {
  return (
    <Modal
      open
      onClose={onClose}
      title="Pay Your Bill"
      description={`Invoice ${payment.invoiceNumber} for account ${payment.accountNumber}`}
      footer={
        <>
          <a href={`/api/invoices/${payment.invoiceId}/pdf`} target="_blank" rel="noreferrer">
            <Button variant="outline">
              <Download className="size-4" />
              Invoice PDF
            </Button>
          </a>
          <Button onClick={onClose}>Done</Button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-text-secondary">
        <div className="rounded-xl border border-line bg-surface-raised px-4 py-2">
          <Row label="Customer Account" value={payment.accountNumber} />
          <Row label="Invoice" value={payment.invoiceNumber} />
          <Row label="Billing period" value={formatPeriodMonth(payment.periodMonth)} />
          <Row label="Due date" value={formatDate(payment.dueDate)} />
          <Row label="Status" value={payment.status === "OVERDUE" ? "Overdue" : "Due"} />
          <div className="mt-1 border-t border-line pt-2">
            <Row label="Amount due" value={formatCurrency(payment.total, payment.currency)} />
            {payment.outstandingCount > 1 && (
              <Row
                label={`Total outstanding (${payment.outstandingCount} bills)`}
                value={formatCurrency(payment.outstandingTotal, payment.currency)}
              />
            )}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-accent-green">How to pay</p>
          {payment.paymentInstructions ? (
            <p className="whitespace-pre-line rounded-xl border border-line bg-surface-raised p-4 text-sm text-text-primary">
              {payment.paymentInstructions}
            </p>
          ) : (
            <p className="text-sm">
              Please contact {payment.companyName} for payment details.
            </p>
          )}
          <p className="mt-2 text-xs text-text-muted">
            Use <span className="font-mono text-text-secondary">{payment.invoiceNumber}</span> as your payment reference.
          </p>
        </div>

        {(payment.companyEmail || payment.companyPhone) && (
          <div className="space-y-2 rounded-xl border border-line bg-surface-raised p-4">
            <p className="text-xs text-text-muted">Billing questions — {payment.companyName}</p>
            {payment.companyEmail && (
              <a href={`mailto:${payment.companyEmail}`} className="flex items-center gap-2 hover:text-text-primary">
                <Mail className="size-4 text-accent-green" />
                <span>{payment.companyEmail}</span>
              </a>
            )}
            {payment.companyPhone && (
              <a href={`tel:${payment.companyPhone.replace(/\s+/g, "")}`} className="flex items-center gap-2 hover:text-text-primary">
                <Phone className="size-4 text-accent-green" />
                <span>{payment.companyPhone}</span>
              </a>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
