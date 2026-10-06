"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Pause, Play, Plus, Repeat, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { RecurringInvoiceModal } from "@/components/admin/RecurringInvoiceModal";
import {
  cancelRecurringInvoiceAction,
  pauseRecurringInvoiceAction,
  resumeRecurringInvoiceAction,
} from "@/lib/actions/recurringInvoices";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import type { BillableCustomerOption, RecurringInvoiceRow } from "@/lib/types/billing";

const STATUS_TONE: Record<RecurringInvoiceRow["status"], BadgeTone> = {
  ACTIVE: "green",
  PAUSED: "amber",
  COMPLETED: "blue",
  CANCELLED: "neutral",
};

export function RecurringInvoicesClient({
  rows,
  customerOptions,
}: {
  rows: RecurringInvoiceRow[];
  customerOptions: BillableCustomerOption[];
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<RecurringInvoiceRow | null>(null);

  async function run(id: string, fn: () => Promise<{ error?: string; success?: string } | undefined>) {
    setBusyId(id);
    const result = await fn();
    setBusyId(null);
    if (result?.error) toast.error(result.error);
    else {
      toast.success(result?.success ?? "Done.");
      router.refresh();
    }
  }

  const activeCount = rows.filter((r) => r.status === "ACTIVE").length;
  const monthlyRecurring = rows
    .filter((r) => r.status === "ACTIVE")
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/billing"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-primary"
      >
        <ArrowLeft className="size-3.5" />
        Back to Billing
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-2xl font-bold text-text-primary">Recurring invoices</p>
          <p className="text-sm text-text-muted">
            {activeCount} active · {formatCurrency(monthlyRecurring)} billed monthly (excl. tax)
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          New Recurring Invoice
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No recurring invoices yet"
          description="Set up a monthly invoice for a customer account that runs for 1 to 36 months."
        />
      ) : (
        <TableContainer>
          <Table>
            <THead>
              <TR>
                <TH>Customer</TH>
                <TH>Description</TH>
                <TH>Monthly</TH>
                <TH>Progress</TH>
                <TH>Next Invoice</TH>
                <TH>Ends</TH>
                <TH>Status</TH>
                <TH className="text-right">Action</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD>
                    {r.customerId ? (
                      <Link href={`/admin/customers/${r.customerId}`} className="text-text-primary hover:underline">
                        {r.customerName}
                      </Link>
                    ) : (
                      <p className="text-text-primary">{r.customerName}</p>
                    )}
                    <p className="font-mono text-xs text-accent-green">{r.accountNumber}</p>
                  </TD>
                  <TD className="max-w-xs">
                    <p className="text-text-primary">{r.description}</p>
                    <p className="text-xs text-text-muted">
                      Day {r.billingDay} · {r.paymentTermsDays === 0 ? "due on issue" : `net ${r.paymentTermsDays}`} ·{" "}
                      {r.autoSend ? "auto-email" : "drafts"}
                    </p>
                    {r.lastError && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-amber">
                        <AlertTriangle className="size-3" />
                        {r.lastError}
                      </p>
                    )}
                  </TD>
                  <TD className="whitespace-nowrap">{formatCurrency(r.amount, r.currency)}</TD>
                  <TD className="whitespace-nowrap">
                    <p className="text-text-primary">
                      {r.cyclesGenerated} / {r.termMonths}
                    </p>
                    <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-surface-raised">
                      <div
                        className="h-full rounded-full bg-accent-green"
                        style={{ width: `${Math.min(100, (r.cyclesGenerated / r.termMonths) * 100)}%` }}
                      />
                    </div>
                  </TD>
                  <TD className="whitespace-nowrap">{r.nextIssueDate ? formatDate(r.nextIssueDate) : "--"}</TD>
                  <TD className="whitespace-nowrap">{r.endDate ? formatDate(r.endDate) : "--"}</TD>
                  <TD>
                    <Badge tone={STATUS_TONE[r.status]}>{r.status.charAt(0) + r.status.slice(1).toLowerCase()}</Badge>
                  </TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1">
                      {r.status === "ACTIVE" && (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => run(r.id, () => pauseRecurringInvoiceAction(r.id))}
                          className="rounded-lg p-1.5 text-text-muted hover:bg-surface-raised hover:text-amber disabled:opacity-50"
                          aria-label="Pause"
                          title="Pause"
                        >
                          <Pause className="size-4" />
                        </button>
                      )}
                      {r.status === "PAUSED" && (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => run(r.id, () => resumeRecurringInvoiceAction(r.id))}
                          className="rounded-lg p-1.5 text-text-muted hover:bg-surface-raised hover:text-accent-green disabled:opacity-50"
                          aria-label="Resume"
                          title="Resume"
                        >
                          <Play className="size-4" />
                        </button>
                      )}
                      {(r.status === "ACTIVE" || r.status === "PAUSED") && (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => setCancelTarget(r)}
                          className="rounded-lg p-1.5 text-text-muted hover:bg-surface-raised hover:text-red disabled:opacity-50"
                          aria-label="Cancel schedule"
                          title="Cancel schedule"
                        >
                          <XCircle className="size-4" />
                        </button>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      )}

      {createOpen && <RecurringInvoiceModal customers={customerOptions} onClose={() => setCreateOpen(false)} />}

      <DeleteConfirmModal
        open={!!cancelTarget}
        title={`Cancel recurring invoice for ${cancelTarget?.customerName ?? "this customer"}?`}
        description="No further invoices will be issued. Invoices already issued are kept."
        confirmLabel="Cancel Schedule"
        loading={busyId === cancelTarget?.id}
        onCancel={() => setCancelTarget(null)}
        onConfirm={async () => {
          if (!cancelTarget) return;
          const target = cancelTarget;
          setCancelTarget(null);
          await run(target.id, () => cancelRecurringInvoiceAction(target.id));
        }}
      />
    </div>
  );
}
