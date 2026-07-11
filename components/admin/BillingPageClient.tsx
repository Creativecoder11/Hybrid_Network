"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Bell,
  CheckCircle2,
  Receipt,
  Search,
  Download,
  Eye,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import {
  TableContainer,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { CreateBillModal } from "@/components/admin/CreateBillModal";
import { MarkPaidModal } from "@/components/admin/MarkPaidModal";
import {
  bulkSendRemindersAction,
  bulkMarkPaidAction,
  markPaidAction,
} from "@/lib/actions/invoices";
import { formatCurrency, formatPeriodMonth } from "@/lib/utils/format";
import type {
  BillableCustomerOption,
  BillingStats,
  InvoiceListRow,
} from "@/lib/types/billing";

const STATUS_TONE: Record<
  InvoiceListRow["status"],
  "green" | "amber" | "red" | "neutral" | "blue"
> = {
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
  q,
  sort,
  stats,
  customerOptions,
  allCustomers,
}: {
  rows: InvoiceListRow[];
  status: string;
  customerId: string;
  period: string;
  q: string;
  sort: string;
  stats: BillingStats;
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

  const [searchInput, setSearchInput] = useState(q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (!v) params.delete(k);
      else params.set(k, v);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (searchInput !== q) updateParams({ q: searchInput });
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

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
    const result = await bulkMarkPaidAction(
      Array.from(selected),
      paymentMethod,
    );
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

  const now = new Date();
  const defaultYear = now.getFullYear();
  const defaultMonth = String(now.getMonth() + 1).padStart(2, "0");
  const periodValue = period
    ? `${period.slice(0, 4)}-${period.slice(4, 6)}`
    : `${defaultYear}-${defaultMonth}`;

  const exportHref = `/api/admin/billing/export?status=${status}&customerId=${customerId}&period=${period}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-2xl font-bold text-text-primary">
            Billing management
          </p>
          <p className="text-sm">
            Cycle: {stats.cycleLabel} · closes in {stats.cycleDaysLeft} days
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Add New Bill
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Billed This Cycle"
          value={formatCurrency(stats.billedThisCycle)}
          icon="/assets/icons/Icon Container4.svg"
          tone="blue"
          animatedBorder
          trend={{
            value: `${Math.abs(stats.billedTrendPct).toFixed(1)}%`,
            positive: stats.billedTrendPct >= 0,
          }}
          sublabel="vs last cycle"
        />
        <StatCard
          label="Collected"
          value={formatCurrency(stats.collected)}
          icon="/assets/icons/Icon Container4.svg"
          tone="green"
          animatedBorder
          trend={{
            value: `${stats.collectionRate.toFixed(1)}%`,
            positive: true,
          }}
          sublabel="Collection rate"
        />
        <StatCard
          label="Pending Review"
          value={formatCurrency(stats.pendingReviewAmount)}
          icon="/assets/icons/Icon Container4.svg"
          tone="amber"
          animatedBorder
          sublabel="Manual Entries · Awaiting approval"
        />
        <StatCard
          label="Overdue Balance"
          value={formatCurrency(stats.overdueAmount)}
          icon="/assets/icons/Icon Container4.svg"
          tone="red"
          animatedBorder
          trend={{ value: `${stats.overdueCount} Accounts`, positive: false }}
          sublabel="Overdue"
        />
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-base font-semibold text-text-primary">
              All Invoices
            </p>
            <p className="text-xs text-text-muted">
              Search, filter, and update customer account details
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:justify-end sm:flex-row sm:items-center">
            <div>
              <Input
                icon={<Search className="size-4" />}
                placeholder="Search invoice, customer, card name..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                // className="sm:w-64"
              />
            </div>
            <div className="sm:w-40">
              <Select
                value={sort}
                onChange={(e) => updateParams({ sort: e.target.value })}
                // className="sm:w-40"
              >
                <option value="date_desc">By Date</option>
                <option value="date_asc">Oldest first</option>
                <option value="amount_desc">Amount: High-Low</option>
                <option value="amount_asc">Amount: Low-High</option>
              </Select>
            </div>
            <div>
              <a href={exportHref}>
                <Button variant="outline" size="md">
                  <Download className="size-6" />
                  Download Bills
                </Button>
              </a>
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div>
            <Select
              value={status}
              onChange={(e) => updateParams({ status: e.target.value })}
              className="sm:w-44"
            >
              <option value="ALL">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="DUE">Due</option>
              <option value="OVERDUE">Overdue</option>
              <option value="PAID">Paid</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
          </div>
          <div>
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
          </div>
          <div>
            <Input
              type="month"
              value={periodValue}
              onChange={(e) =>
                updateParams({ period: e.target.value.replace("-", "") })
              }
              className="sm:w-44"
            />
          </div>
        </div>

        {selected.size > 0 && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-accent-blue/30 bg-accent-blue/10 px-4 py-3">
            <p className="text-sm text-accent-blue">{selected.size} selected</p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkReminders}
                loading={sendingReminders}
              >
                <Bell className="size-3.5" />
                Send Reminders
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setBulkMarkPaidOpen(true)}
              >
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
                Add New Bill
              </Button>
            }
          />
        ) : (
          <TableContainer>
            <Table>
              <THead>
                <TR>
                  <TH>
                    <Checkbox
                      checked={selected.size === rows.length}
                      onChange={toggleAll}
                    />
                  </TH>
                  <TH>Invoice</TH>
                  <TH>Customer</TH>
                  <TH>Product &amp; Service</TH>
                  <TH>Card Name</TH>
                  <TH>Period</TH>
                  <TH>Usage</TH>
                  <TH>Amount</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Action</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((inv) => (
                  <TR key={inv.id}>
                    <TD>
                      <Checkbox
                        checked={selected.has(inv.id)}
                        onChange={() => toggleOne(inv.id)}
                      />
                    </TD>
                    <TD className="font-medium text-text-primary">
                      <Link
                        href={`/admin/billing/${inv.id}`}
                        className="hover:underline"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    </TD>
                    <TD>
                      <p className="text-text-primary">{inv.customerName}</p>
                      {inv.customerCode && (
                        <p className="text-xs text-accent-green">
                          {inv.customerCode}
                        </p>
                      )}
                    </TD>
                    <TD>
                      <p className="text-text-primary">{inv.vendor}</p>
                      <p className="text-xs text-accent-blue">{inv.planName}</p>
                    </TD>
                    <TD className="text-text-secondary">{inv.cardName}</TD>
                    <TD>{formatPeriodMonth(inv.periodMonth)}</TD>
                    <TD className="text-text-secondary">
                      {inv.usageGB.toFixed(2)} GB
                    </TD>
                    <TD>{formatCurrency(inv.total, inv.currency)}</TD>
                    <TD>
                      <Badge tone={STATUS_TONE[inv.status]}>{inv.status}</Badge>
                    </TD>
                    <TD>
                      <div className="flex items-center justify-end gap-1">
                        {inv.status !== "PAID" &&
                          inv.status !== "CANCELLED" && (
                            <button
                              onClick={() => setSingleMarkPaidId(inv.id)}
                              className="rounded-lg p-1.5 text-text-muted hover:bg-surface-raised hover:text-accent-green"
                              aria-label="Mark paid"
                            >
                              <CheckCircle2 className="size-4" />
                            </button>
                          )}
                        <Link
                          href={`/admin/billing/${inv.id}`}
                          className="rounded-lg p-1.5 text-text-muted hover:bg-surface-raised hover:text-text-primary"
                          aria-label="View invoice"
                        >
                          <Eye className="size-4" />
                        </Link>
                        <a
                          href={`/api/invoices/${inv.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg p-1.5 text-text-muted hover:bg-surface-raised hover:text-accent-blue"
                          aria-label="Download PDF"
                        >
                          <Download className="size-4" />
                        </a>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        )}
      </div>

      {createOpen && (
        <CreateBillModal
          customers={customerOptions}
          onClose={() => setCreateOpen(false)}
        />
      )}
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
