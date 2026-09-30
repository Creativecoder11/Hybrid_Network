"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Plus, RefreshCw, Pause, Play, XCircle, Repeat } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { RecurringInvoiceFormModal } from "@/components/admin/RecurringInvoiceFormModal";
import { generateRecurringInvoicesNowAction, setRecurringInvoiceStatusAction } from "@/lib/actions/recurringInvoices";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import type { RecurringAccountOption, RecurringInvoiceRow } from "@/lib/types/billing";

const STATUS_TONE: Record<RecurringInvoiceRow["status"], "green" | "amber" | "neutral" | "red"> = {
  ACTIVE: "green",
  PAUSED: "amber",
  COMPLETED: "neutral",
  CANCELLED: "red",
};

const STATUS_LABEL: Record<RecurringInvoiceRow["status"], string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export function RecurringInvoicesPageClient({
  rows,
  accountOptions,
  defaultTaxRate,
  taxLabel,
  cronEnabled,
}: {
  rows: RecurringInvoiceRow[];
  accountOptions: RecurringAccountOption[];
  defaultTaxRate: number;
  taxLabel: string;
  cronEnabled: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<{ error?: string; success?: string } | undefined>) {
    setPending(key);
    try {
      const result = await fn();
      if (result?.error) toast.error(result.error);
      else {
        toast.success(result?.success ?? "Done.");
        router.refresh();
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPending(null);
    }
  }

  function changeStatus(row: RecurringInvoiceRow, status: "ACTIVE" | "PAUSED" | "CANCELLED") {
    if (status === "CANCELLED" && !confirm("Cancel this recurring invoice? No more invoices will be generated. Invoices already created are kept.")) return;
    if (status === "ACTIVE" && !confirm("Resume this recurring invoice? Months that fell due while it was paused are created as drafts on the next run.")) return;
    run(`${status}-${row.id}`, () => setRecurringInvoiceStatusAction(row.id, status));
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/billing" className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-primary">
        <ArrowLeft className="size-3.5" />
        Back to Billing
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-2xl font-bold text-text-primary">Recurring invoices</p>
          <p className="max-w-2xl text-sm text-text-muted">
            Bill a Customer Account the same line items every month for 1–36 months. Each month a <strong>draft</strong> invoice
            is created for you to review and send.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => run("generate", generateRecurringInvoicesNowAction)} loading={pending === "generate"}>
            {pending !== "generate" && <RefreshCw className="size-4" />}
            Generate due invoices now
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            New recurring invoice
          </Button>
        </div>
      </div>

      {!cronEnabled && (
        <p className="rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 text-xs text-amber">
          Automatic daily generation is off (CRON_SECRET isn&apos;t set on this server). Drafts are only created when you click
          &ldquo;Generate due invoices now&rdquo; or add a schedule starting today. See docs/deployment.md to set up the daily cron job.
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={Repeat} title="No recurring invoices yet" description="Create one to bill a customer every month automatically." />
      ) : (
        <TableContainer>
          <Table>
            <THead>
              <TR>
                <TH>Customer</TH>
                <TH>Per invoice</TH>
                <TH>Schedule</TH>
                <TH>Progress</TH>
                <TH>Next invoice</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <Link href={`/admin/customers/${r.customerId}`} className="font-medium text-text-primary hover:underline">
                      {r.customerName}
                    </Link>
                    <p className="font-mono text-xs text-accent-green">{r.accountNumber}</p>
                  </TD>
                  <TD>
                    <p className="font-semibold text-text-primary">{formatCurrency(r.totalPerInvoice, r.currency)}</p>
                    <p className="max-w-56 truncate text-xs text-text-muted" title={r.lineItems.map((li) => li.description).join(", ")}>
                      {r.lineItems.map((li) => li.description).join(", ")}
                    </p>
                    <p className="text-[11px] text-text-muted">
                      incl. {r.taxLabel} {r.taxRate}% · due in {r.dueDays} days
                    </p>
                  </TD>
                  <TD className="text-xs text-text-secondary">
                    <p>
                      {r.durationMonths} month{r.durationMonths === 1 ? "" : "s"}
                    </p>
                    <p className="text-text-muted">
                      {formatDate(r.startDate)} – {formatDate(r.endDate)}
                    </p>
                  </TD>
                  <TD className="text-xs">
                    <p className="font-medium text-text-primary">
                      {r.invoicesGenerated} / {r.durationMonths} created
                    </p>
                    {r.invoices.length > 0 && (
                      <p className="mt-0.5 flex max-w-56 flex-wrap gap-x-2">
                        {r.invoices.slice(-4).map((inv) => (
                          <Link key={inv.id} href={`/admin/billing/${inv.id}`} className="font-mono text-accent-blue hover:underline" title={`Month ${inv.sequence} · ${inv.status}`}>
                            {inv.invoiceNumber}
                          </Link>
                        ))}
                        {r.invoices.length > 4 && <span className="text-text-muted">+{r.invoices.length - 4} more</span>}
                      </p>
                    )}
                  </TD>
                  <TD className="text-xs text-text-secondary">{r.nextInvoiceDate ? formatDate(r.nextInvoiceDate) : "—"}</TD>
                  <TD>
                    <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  </TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1">
                      {r.status === "ACTIVE" && (
                        <button
                          type="button"
                          onClick={() => changeStatus(r, "PAUSED")}
                          disabled={pending !== null}
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
                          onClick={() => changeStatus(r, "ACTIVE")}
                          disabled={pending !== null}
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
                          onClick={() => changeStatus(r, "CANCELLED")}
                          disabled={pending !== null}
                          className="rounded-lg p-1.5 text-text-muted hover:bg-surface-raised hover:text-red disabled:opacity-50"
                          aria-label="Cancel schedule"
                          title="Cancel"
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

      {creating && (
        <RecurringInvoiceFormModal
          accountOptions={accountOptions}
          defaultTaxRate={defaultTaxRate}
          taxLabel={taxLabel}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}
