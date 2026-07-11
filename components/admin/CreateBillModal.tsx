"use client";

import { useActionState, useMemo, useState } from "react";
import { ChevronDown, User as UserIcon, Wifi, CreditCard } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { createInvoiceAction } from "@/lib/actions/invoices";
import type { ActionState } from "@/lib/actions/customers";
import type { BillableCustomerOption } from "@/lib/types/billing";
import { formatCurrency, formatDate } from "@/lib/utils/format";

function currentPeriodMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "DUE", label: "Due" },
  { value: "PAID", label: "Paid" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function CreateBillModal({
  customers,
  onClose,
}: {
  customers: BillableCustomerOption[];
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    createInvoiceAction,
    undefined
  );

  const periodValue = currentPeriodMonth();
  const monthInputDefault = `${periodValue.slice(0, 4)}-${periodValue.slice(4, 6)}`;

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<BillableCustomerOption | null>(null);
  const [amount, setAmount] = useState("");

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
  }

  function changeCustomer() {
    setSelected(null);
    setSearch("");
    setAmount("");
    setOpen(true);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Create New Bill"
      description="Create an account and assign a service plan"
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="bill-form" loading={isPending} disabled={!selected}>
            Create Bill
          </Button>
        </>
      }
    >
      <form
        id="bill-form"
        action={formAction}
        className="space-y-5"
        onSubmit={(e) => {
          const monthInput = e.currentTarget.elements.namedItem("periodMonthDisplay") as HTMLInputElement;
          const hidden = e.currentTarget.elements.namedItem("periodMonth") as HTMLInputElement;
          if (monthInput?.value) hidden.value = monthInput.value.replace("-", "");
        }}
      >
        <input type="hidden" name="customerId" value={selected?.id ?? ""} />

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent-green">Customer</p>
          <Label required>Find Customer</Label>
          <div className="relative">
            <Input
              icon={<UserIcon className="size-4" />}
              placeholder="Search by name or customer code..."
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
                    key={c.id}
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

          {selected && (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-line bg-surface-raised px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-accent-green/15 text-accent-green">
                  <UserIcon className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{selected.label.replace(/\s*\(.*\)$/, "")}</p>
                  <p className="flex items-center gap-1.5 text-xs text-text-muted">
                    {selected.customerCode && <span>{selected.customerCode}</span>}
                    <span>· Customer since {formatDate(selected.customerSince)}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={changeCustomer}
                className="text-xs font-medium text-accent-green hover:underline"
              >
                Change Customer
              </button>
            </div>
          )}
        </div>

        {selected && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent-green">Current Plan</p>
            <div className="flex items-center justify-between rounded-xl bg-text-primary/5 px-4 py-3.5">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-accent-blue/15 text-accent-blue">
                  <Wifi className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{selected.planName}</p>
                  <p className="text-xs text-text-secondary">{selected.planSpecLabel}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-accent-blue">
                  {formatCurrency(selected.planMonthlyPrice, selected.planCurrency)}
                </p>
                <p className="text-xs text-text-muted">Per Month</p>
              </div>
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent-green">Bill Details</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label required>Amount</Label>
              <Input
                name="amount"
                type="number"
                min={0}
                step="0.01"
                icon={<CreditCard className="size-4" />}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <Label required>Due Date</Label>
              <Input name="dueDate" type="date" defaultValue={defaultDueDate()} required />
            </div>
            <div>
              <Label required>Billing Period</Label>
              <input type="hidden" name="periodMonth" defaultValue={periodValue} />
              <Input name="periodMonthDisplay" type="month" defaultValue={monthInputDefault} required />
            </div>
            <div>
              <Label required>Bill Status</Label>
              <Select name="status" defaultValue="DRAFT">
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-accent-green to-accent-blue px-5 py-4">
          <p className="text-sm font-semibold text-white">Total Bill</p>
          <p className="text-xl font-bold text-white">
            {formatCurrency(Number(amount) || 0, selected?.planCurrency ?? "USD")}
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
