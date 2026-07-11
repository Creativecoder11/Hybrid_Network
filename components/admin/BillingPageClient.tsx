"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Bell, CheckCircle2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Badge } from "@/components/ui/Badge";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { CreateInvoiceModal } from "@/components/admin/CreateInvoiceModal";
import { MarkPaidModal } from "@/components/admin/MarkPaidModal";
import { bulkSendRemindersAction, bulkMarkPaidAction, markPaidAction } from "@/lib/actions/invoices";
import { formatCurrency, formatDate, formatPeriodMonth } from "@/lib/utils/format";
import type { BillableCustomerOption, InvoiceListRow } from "@/lib/types/billing";

const STATUS_TONE: Record<InvoiceListRow["status"], "green" | "amber" | "red" | "neutral" | "blue"> = {
  DRAFT: "neutral",
  SENT: "amber",
  DUE: "amber",
  OVERDUE: "red",
  PAID: "green",
  CANCELLED: "neutral",
};

export function BillingPageClient({
  rows,
  status,
  customerId,
  period,
  customerOptions,
  allCustomers,
}: {
  rows: InvoiceListRow[];
  status: string;
  customerId: string;
  period: string;
  customerOptions: BillableCustomerOption[];
  allCustomers: { id: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMarkPaidOpen, setBulkMarkPaidOpen] = useState(false);
  const [singleMarkPaidId, setSingleMarkPaidId] = useState<string | null>(null);
  const [sendingReminders, setSendingReminders] = useState(false);

  function updateParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (!v) params.delete(k);
      else params.set(k, v);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggleAll() {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  }
  function toggleOne(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkReminders() {
    setSendingReminders(true);
    const result = await bulkSendRemindersAction(Array.from(selected));
    setSendingReminders(false);
    if (result?.error) toast.error(result.error);
    else {
      toast.success(result?.success ?? "Reminders sent.");
      setSelected(new Set());
      router.refresh();
    }
  }

  async function handleBulkMarkPaid(paymentMethod: string) {
    const result = await bulkMarkPaidAction(Array.from(selected), paymentMethod);
    if (!result?.error) {
      setSelected(new Set());
      router.refresh();
    }
    return result;
  }

  async function handleSingleMarkPaid(paymentMethod: string, paidDate: string) {
    if (!singleMarkPaidId) return { error: "Missing invoice." };
    const fd = new FormData();
    fd.set("invoiceId", singleMarkPaidId);
    fd.set("paymentMethod", paymentMethod);
    fd.set("paidDate", paidDate);
    const result = await markPaidAction(undefined, fd);
    if (!result?.error) router.refresh();
    return result;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Billing</h1>
          <p className="text-sm text-text-muted">Generate, send, and track customer invoices.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Create Invoice
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={status} onChange={(e) => updateParams({ status: e.target.value })} className="sm:w-44">
          <option value="ALL">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="DUE">Due</option>
          <option value="OVERDUE">Overdue</option>
          <option value="PAID">Paid</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
        <Select
          value={customerId}
          onChange={(e) => updateParams({ customerId: e.target.value })}
          className="sm:w-56"
        >
          <option value="">All customers</option>
          {allCustomers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
        <Input
          type="month"
          value={period ? `${period.slice(0, 4)}-${period.slice(4, 6)}` : ""}
          onChange={(e) => updateParams({ period: e.target.value.replace("-", "") })}
          className="sm:w-44"
        />
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-accent-blue/30 bg-accent-blue/10 px-4 py-3">
          <p className="text-sm text-accent-blue">{selected.size} selected</p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleBulkReminders} loading={sendingReminders}>
              <Bell className="size-3.5" />
              Send Reminders
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setBulkMarkPaidOpen(true)}>
              <CheckCircle2 className="size-3.5" />
              Mark Paid
            </Button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No invoices found"
          description="Create your first invoice or adjust your filters."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Create Invoice
            </Button>
          }
        />
      ) : (
        <TableContainer>
          <Table>
            <THead>
              <TR>
                <TH>
                  <Checkbox checked={selected.size === rows.length} onChange={toggleAll} />
                </TH>
                <TH>Invoice #</TH>
                <TH>Customer</TH>
                <TH>Period</TH>
                <TH>Due Date</TH>
                <TH>Amount</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((inv) => (
                <TR key={inv.id}>
                  <TD>
                    <Checkbox checked={selected.has(inv.id)} onChange={() => toggleOne(inv.id)} />
                  </TD>
                  <TD className="font-medium text-text-primary">
                    <Link href={`/admin/billing/${inv.id}`} className="hover:underline">
                      {inv.invoiceNumber}
                    </Link>
                  </TD>
                  <TD>
                    <p className="text-text-primary">{inv.customerName}</p>
                    {inv.customerCode && <p className="text-xs text-accent-green">{inv.customerCode}</p>}
                  </TD>
                  <TD>{formatPeriodMonth(inv.periodMonth)}</TD>
                  <TD className="text-text-secondary">{formatDate(inv.dueDate)}</TD>
                  <TD>{formatCurrency(inv.total, inv.currency)}</TD>
                  <TD>
                    <Badge tone={STATUS_TONE[inv.status]}>{inv.status}</Badge>
                  </TD>
                  <TD>
                    <div className="flex items-center justify-end gap-2 text-xs">
                      <a
                        href={`/api/invoices/${inv.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-accent-blue hover:underline"
                      >
                        PDF
                      </a>
                      {inv.status !== "PAID" && inv.status !== "CANCELLED" && (
                        <button
                          onClick={() => setSingleMarkPaidId(inv.id)}
                          className="font-medium text-accent-green hover:underline"
                        >
                          Mark Paid
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

      {createOpen && <CreateInvoiceModal customers={customerOptions} onClose={() => setCreateOpen(false)} />}
      {bulkMarkPaidOpen && (
        <MarkPaidModal
          title={`Mark ${selected.size} invoice${selected.size === 1 ? "" : "s"} as paid`}
          onClose={() => setBulkMarkPaidOpen(false)}
          onConfirm={(method) => handleBulkMarkPaid(method)}
        />
      )}
      {singleMarkPaidId && (
        <MarkPaidModal
          title="Mark invoice as paid"
          onClose={() => setSingleMarkPaidId(null)}
          onConfirm={handleSingleMarkPaid}
        />
      )}
    </div>
  );
}
