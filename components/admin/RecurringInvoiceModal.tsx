"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, User as UserIcon, CreditCard } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { createRecurringInvoiceAction } from "@/lib/actions/recurringInvoices";
import type { ActionState } from "@/lib/actions/customers";
import type { BillableCustomerOption } from "@/lib/types/billing";
import { formatCurrency, formatDate } from "@/lib/utils/format";

const TERM_OPTIONS = Array.from({ length: 36 }, (_, i) => i + 1);
const QUICK_TERMS = [1, 3, 6, 12, 24, 36];

function todayInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Same month-end clamping as lib/billing/recurringSchedule.ts, for the preview. */
function lastInvoiceDate(start: string, termMonths: number): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(start);
  if (!m) return null;
  const day = Number(m[3]);
  const first = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + termMonths - 1, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(day, lastDay)));
}

export function RecurringInvoiceModal({
  customers,
  onClose,
}: {
  customers: BillableCustomerOption[];
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    createRecurringInvoiceAction,
    undefined
  );

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<BillableCustomerOption | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [termMonths, setTermMonths] = useState(12);
  const [startDate, setStartDate] = useState(todayInput());
  const [autoSend, setAutoSend] = useState(true);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      onClose();
    }
  }, [state, onClose]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return customers.slice(0, 8);
    return customers.filter((c) => c.label.toLowerCase().includes(needle)).slice(0, 8);
  }, [search, customers]);

  function pickCustomer(c: BillableCustomerOption) {
    setSelected(c);
    setSearch(c.label);
    setOpen(false);
    setAmount(String(c.planMonthlyPrice));
    setDescription(`${c.planName} — Monthly Subscription`);
  }

  const monthly = Number(amount) || 0;
  const currency = selected?.planCurrency ?? "USD";
  const lastDate = lastInvoiceDate(startDate, termMonths);

  return (
    <Modal
      open
      onClose={onClose}
      title="New Recurring Invoice"
      description="Bill a Customer Account the same amount every month for a fixed term"
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="recurring-form" loading={isPending} disabled={!selected}>
            Create Schedule
          </Button>
        </>
      }
    >
      <form id="recurring-form" action={formAction} className="space-y-5">
        <input type="hidden" name="customerId" value={selected?.id ?? ""} />
        <input type="hidden" name="customerAccountId" value={selected?.accountId ?? ""} />
        <input type="hidden" name="autoSend" value={autoSend ? "true" : "false"} />

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent-green">Customer</p>
          <Label required>Customer Account</Label>
          <div className="relative">
            <Input
              icon={<UserIcon className="size-4" />}
              placeholder="Search by name or account number..."
              value={search}
              onFocus={() => setOpen(true)}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelected(null);
                setOpen(true);
              }}
            />
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
            {open && filtered.length > 0 && (
              <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-line bg-surface-raised shadow-xl">
                {filtered.map((c) => (
                  <button
                    key={c.accountId}
                    type="button"
                    onClick={() => pickCustomer(c)}
                    className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm text-text-primary hover:bg-surface"
                  >
                    <span>{c.label}</span>
                    <span className="text-xs text-text-muted">{c.planName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {customers.length === 0 && (
            <p className="mt-1.5 text-xs text-text-muted">No Customer Account has an active service plan yet.</p>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent-green">Schedule</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label required>Line Item Description</Label>
              <Input
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Starlink Maritime — Monthly Subscription"
                required
              />
            </div>
            <div>
              <Label required>Monthly Amount (excl. tax)</Label>
              <Input
                name="amount"
                type="number"
                min={0.01}
                step="0.01"
                icon={<CreditCard className="size-4" />}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <Label required>Term</Label>
              <Select name="termMonths" value={termMonths} onChange={(e) => setTermMonths(Number(e.target.value))}>
                {TERM_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} month{n === 1 ? "" : "s"}
                  </option>
                ))}
              </Select>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {QUICK_TERMS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setTermMonths(n)}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                      termMonths === n
                        ? "border-accent-green/40 bg-accent-green/15 text-accent-green"
                        : "border-line text-text-secondary hover:bg-surface-raised"
                    }`}
                  >
                    {n}m
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label required>First Invoice Date</Label>
              <Input
                name="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
              <p className="mt-1 text-[11px] text-text-muted">Later invoices are issued on the same day each month.</p>
            </div>
            <div>
              <Label required>Payment Terms</Label>
              <Select name="paymentTermsDays" defaultValue="14">
                <option value="0">Due on issue</option>
                <option value="7">Net 7 days</option>
                <option value="14">Net 14 days</option>
                <option value="30">Net 30 days</option>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-line bg-surface-raised p-4">
          <div className="space-y-0.5 pr-4">
            <p className="text-sm font-semibold text-text-primary">Email each invoice automatically</p>
            <p className="text-xs text-text-muted">
              Sends the PDF to the customer when each invoice is issued. When off, invoices are created as Drafts for
              you to review and send.
            </p>
          </div>
          <Switch checked={autoSend} onChange={setAutoSend} />
        </div>

        <div className="rounded-xl bg-gradient-to-r from-accent-green to-accent-blue px-5 py-4 text-white">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              {termMonths} × {formatCurrency(monthly, currency)}
            </p>
            <p className="text-xl font-bold">{formatCurrency(monthly * termMonths, currency)}</p>
          </div>
          <p className="mt-1 text-xs text-white/80">
            {startDate ? `${formatDate(startDate)} → ${formatDate(lastDate)}` : ""} · tax added per invoice from
            Settings
          </p>
        </div>

        {state?.error && (
          <div className="rounded-xl border border-red/30 bg-red/10 px-3.5 py-2.5 text-xs text-red">
            {state.error}
          </div>
        )}
      </form>
    </Modal>
  );
}
