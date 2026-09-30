"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Plus, Trash2, User as UserIcon } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { createRecurringInvoiceAction } from "@/lib/actions/recurringInvoices";
import {
  MAX_RECURRING_MONTHS,
  MIN_RECURRING_MONTHS,
  parseDateOnly,
  scheduleSummary,
  toDateOnlyString,
} from "@/lib/billing/schedule";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import type { ActionState } from "@/lib/actions/customers";
import type { RecurringAccountOption } from "@/lib/types/billing";

type Line = { key: number; description: string; quantity: string; unit: string; unitPrice: string };

const DURATIONS = Array.from({ length: MAX_RECURRING_MONTHS - MIN_RECURRING_MONTHS + 1 }, (_, i) => i + MIN_RECURRING_MONTHS);

function firstOfNextMonth(): string {
  const now = new Date();
  return toDateOnlyString(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)));
}

const accountLabel = (a: RecurringAccountOption) => `${a.customerName} (${a.accountNumber})`;

export function RecurringInvoiceFormModal({
  accountOptions,
  defaultTaxRate,
  taxLabel,
  onClose,
}: {
  accountOptions: RecurringAccountOption[];
  defaultTaxRate: number;
  taxLabel: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(createRecurringInvoiceAction, undefined);

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState<RecurringAccountOption | null>(null);
  const [startDate, setStartDate] = useState(firstOfNextMonth());
  const [months, setMonths] = useState(12);
  const [taxRate, setTaxRate] = useState(String(defaultTaxRate));
  const [lines, setLines] = useState<Line[]>([{ key: 1, description: "", quantity: "1", unit: "month", unitPrice: "" }]);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      router.refresh();
      onClose();
    }
  }, [state, router, onClose]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = needle
      ? accountOptions.filter((a) => `${a.customerName} ${a.accountNumber} ${a.planName}`.toLowerCase().includes(needle))
      : accountOptions;
    return list.slice(0, 8);
  }, [search, accountOptions]);

  function pick(a: RecurringAccountOption) {
    setAccount(a);
    setSearch(accountLabel(a));
    setOpen(false);
    // Start from the account's plan when the first line is still empty.
    setLines((prev) =>
      prev.length === 1 && !prev[0].description && !prev[0].unitPrice && a.planName
        ? [{ ...prev[0], description: `${a.planName} — Monthly Subscription`, unitPrice: a.planMonthlyPrice !== null ? String(a.planMonthlyPrice) : "" }]
        : prev
    );
  }

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  const currency = account?.currency ?? "USD";
  const subtotal = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const tax = subtotal * ((Number(taxRate) || 0) / 100);
  const start = parseDateOnly(startDate);
  const summary = start ? scheduleSummary(start, months) : null;

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title="New recurring invoice"
      description="The same line items are invoiced every month. Each invoice is created as a draft for you to review and send."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="recurring-form" loading={isPending} disabled={!account}>
            Create recurring invoice
          </Button>
        </>
      }
    >
      <form id="recurring-form" action={formAction} className="space-y-5">
        <input type="hidden" name="customerAccountId" value={account?.accountId ?? ""} />

        <div>
          <Label required>Customer Account</Label>
          <div className="relative">
            <Input
              icon={<UserIcon className="size-4" />}
              placeholder="Search by customer, account number or plan..."
              value={search}
              onFocus={() => setOpen(true)}
              onChange={(e) => {
                setSearch(e.target.value);
                setAccount(null);
                setOpen(true);
              }}
            />
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
            {open && !account && (
              <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-line bg-surface-raised shadow-xl">
                {filtered.length === 0 ? (
                  <p className="px-3.5 py-2.5 text-sm text-text-muted">No accounts match.</p>
                ) : (
                  filtered.map((a) => (
                    <button
                      key={a.accountId}
                      type="button"
                      onClick={() => pick(a)}
                      className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm text-text-primary hover:bg-surface"
                    >
                      <span className="truncate">{accountLabel(a)}</span>
                      <span className="shrink-0 text-xs text-text-muted">{a.planName || "No active plan"}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <Label required>Start date</Label>
            <Input type="date" name="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </div>
          <div>
            <Label required>Duration</Label>
            <Select name="durationMonths" value={String(months)} onChange={(e) => setMonths(Number(e.target.value))}>
              {DURATIONS.map((m) => (
                <option key={m} value={m}>
                  {m} month{m === 1 ? "" : "s"}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Payment due (days)</Label>
            <Input type="number" name="dueDays" defaultValue={14} min={0} max={120} />
          </div>
          <div>
            <Label>{taxLabel} rate (%)</Label>
            <Input type="number" name="taxRate" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} min={0} max={100} step="0.01" />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label required>Line items (every invoice)</Label>
            <button
              type="button"
              onClick={() => setLines((prev) => [...prev, { key: Date.now(), description: "", quantity: "1", unit: "", unitPrice: "" }])}
              className="inline-flex items-center gap-1 text-xs font-medium text-accent-green hover:underline"
            >
              <Plus className="size-3.5" /> Add line
            </button>
          </div>
          <div className="space-y-2">
            {lines.map((l) => (
              <div key={l.key} className="grid grid-cols-12 gap-2">
                <Input className="col-span-12 sm:col-span-6" name="lineDescription" placeholder="Description" value={l.description} onChange={(e) => updateLine(l.key, { description: e.target.value })} />
                <Input className="col-span-3 sm:col-span-1" name="lineQuantity" type="number" min={0} step="any" aria-label="Quantity" value={l.quantity} onChange={(e) => updateLine(l.key, { quantity: e.target.value })} />
                <Input className="col-span-4 sm:col-span-2" name="lineUnit" placeholder="Unit" value={l.unit} onChange={(e) => updateLine(l.key, { unit: e.target.value })} />
                <Input className="col-span-4 sm:col-span-2" name="lineUnitPrice" type="number" min={0} step="0.01" placeholder="Unit price" value={l.unitPrice} onChange={(e) => updateLine(l.key, { unitPrice: e.target.value })} />
                <button
                  type="button"
                  onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                  disabled={lines.length === 1}
                  className="col-span-1 flex items-center justify-center rounded-lg text-text-muted hover:text-red disabled:opacity-30"
                  aria-label="Remove line"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label>Notes (internal)</Label>
          <Input name="notes" placeholder="e.g. 12-month contract signed 28 Sep 2026" maxLength={500} />
        </div>

        <div className="rounded-xl border border-line bg-surface-raised p-4 text-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent-green">Schedule preview</p>
          {summary ? (
            <div className="grid grid-cols-1 gap-1.5 text-text-secondary sm:grid-cols-2">
              <p>
                <span className="text-text-muted">Invoices:</span> {months} (monthly)
              </p>
              <p>
                <span className="text-text-muted">Per invoice:</span>{" "}
                <strong className="text-text-primary">{formatCurrency(subtotal + tax, currency)}</strong>{" "}
                <span className="text-xs text-text-muted">
                  ({formatCurrency(subtotal, currency)} + {taxLabel})
                </span>
              </p>
              <p>
                <span className="text-text-muted">First invoice:</span> {formatDate(toDateOnlyString(summary.firstInvoiceDate))}
              </p>
              <p>
                <span className="text-text-muted">Last invoice:</span> {formatDate(toDateOnlyString(summary.lastInvoiceDate))}
              </p>
              <p>
                <span className="text-text-muted">Covers until:</span> {formatDate(toDateOnlyString(summary.endDate))}
              </p>
              <p>
                <span className="text-text-muted">Total over term:</span> {formatCurrency((subtotal + tax) * months, currency)}
              </p>
            </div>
          ) : (
            <p className="text-text-muted">Enter a valid start date to see the schedule.</p>
          )}
        </div>

        {state?.error && (
          <div className="rounded-xl border border-red/30 bg-red/10 px-3.5 py-2.5 text-xs text-red">{state.error}</div>
        )}
      </form>
    </Modal>
  );
}
