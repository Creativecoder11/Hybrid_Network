"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/ui/Badge";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { restoreInvoiceAction, purgeInvoiceAction } from "@/lib/actions/invoices";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";
import type { TrashedInvoiceRow } from "@/lib/types/billing";

export function BillingTrashView({
  rows,
  onBack,
}: {
  rows: TrashedInvoiceRow[];
  onBack: () => void;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<TrashedInvoiceRow | null>(null);

  async function handleRestore(row: TrashedInvoiceRow) {
    setBusyId(row.id);
    const result = await restoreInvoiceAction(row.id);
    setBusyId(null);
    if (result?.error) toast.error(result.error);
    else {
      toast.success(result?.success ?? "Bill restored.");
      router.refresh();
    }
  }

  async function handlePurge() {
    if (!purgeTarget) return;
    setBusyId(purgeTarget.id);
    const result = await purgeInvoiceAction(purgeTarget.id);
    setBusyId(null);
    if (result?.error) toast.error(result.error);
    else {
      toast.success(result?.success ?? "Bill permanently deleted.");
      setPurgeTarget(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            onClick={onBack}
            className="mb-1 flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-primary"
          >
            <ArrowLeft className="size-3.5" />
            Back to Billing
          </button>
          <p className="text-2xl font-bold text-text-primary">Trash</p>
          <p className="text-sm text-text-muted">
            Deleted bills are kept here until restored or permanently removed.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5">
        {rows.length === 0 ? (
          <EmptyState icon={Trash2} title="Trash is empty" description="Deleted bills will show up here." />
        ) : (
          <TableContainer>
            <Table>
              <THead>
                <TR>
                  <TH>Invoice</TH>
                  <TH>Customer</TH>
                  <TH>Amount</TH>
                  <TH>Status</TH>
                  <TH>Deleted On</TH>
                  <TH className="text-right">Action</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.id}>
                    <TD className="font-medium text-text-primary">{row.invoiceNumber}</TD>
                    <TD>
                      <p className="text-text-primary">{row.customerName}</p>
                      {row.customerCode && <p className="text-xs text-accent-green">{row.customerCode}</p>}
                    </TD>
                    <TD>{formatCurrency(row.total, row.currency)}</TD>
                    <TD>
                      <StatusBadge status={row.status} />
                    </TD>
                    <TD className="text-text-secondary">{formatDateTime(row.deletedAt)}</TD>
                    <TD>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleRestore(row)}
                          disabled={busyId === row.id}
                          className="rounded-lg p-1.5 text-text-muted hover:bg-surface-raised hover:text-accent-green disabled:opacity-50"
                          aria-label="Restore bill"
                        >
                          <RotateCcw className="size-4" />
                        </button>
                        <button
                          onClick={() => setPurgeTarget(row)}
                          disabled={busyId === row.id}
                          className="rounded-lg p-1.5 text-text-muted hover:bg-red/10 hover:text-red disabled:opacity-50"
                          aria-label="Delete permanently"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        )}
      </div>

      <DeleteConfirmModal
        open={!!purgeTarget}
        title={`Permanently delete ${purgeTarget?.invoiceNumber ?? "this bill"}?`}
        description="This bill will be permanently removed and cannot be recovered — even from Trash."
        confirmLabel="Delete Forever"
        loading={!!purgeTarget && busyId === purgeTarget.id}
        onCancel={() => setPurgeTarget(null)}
        onConfirm={handlePurge}
      />
    </div>
  );
}
