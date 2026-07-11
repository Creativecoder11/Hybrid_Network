"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { createInvoiceAction } from "@/lib/actions/invoices";
import type { ActionState } from "@/lib/actions/customers";
import type { BillableCustomerOption } from "@/lib/types/billing";

function currentPeriodMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

type ExtraLine = { id: number; description: string; quantity: string; unit: string; unitPrice: string };

export function CreateInvoiceModal({
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
  const [extraLines, setExtraLines] = useState<ExtraLine[]>([]);

  const periodValue = currentPeriodMonth();
  const monthInputDefault = `${periodValue.slice(0, 4)}-${periodValue.slice(4, 6)}`;

  return (
    <Modal open onClose={onClose} title="Create Invoice" size="lg" footer={
      <>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form="invoice-form" loading={isPending}>
          Create Invoice
        </Button>
      </>
    }>
      <form
        id="invoice-form"
        action={formAction}
        className="space-y-4"
        onSubmit={(e) => {
          const monthInput = (e.currentTarget.elements.namedItem("periodMonthDisplay") as HTMLInputElement);
          const hidden = e.currentTarget.elements.namedItem("periodMonth") as HTMLInputElement;
          if (monthInput?.value) hidden.value = monthInput.value.replace("-", "");
        }}
      >
        <div>
          <Label required>Customer</Label>
          <Select name="customerId" required defaultValue="">
            <option value="" disabled>
              Select a customer with an active plan...
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label required>Billing Period</Label>
            <input type="hidden" name="periodMonth" defaultValue={periodValue} />
            <Input name="periodMonthDisplay" type="month" defaultValue={monthInputDefault} required />
          </div>
          <div>
            <Label required>Due Date</Label>
            <Input name="dueDate" type="date" defaultValue={defaultDueDate()} required />
          </div>
        </div>

        <p className="text-xs text-text-muted">
          The plan&apos;s monthly price and any data/voice overage for the selected period are calculated
          automatically. Add extra line items below if needed.
        </p>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Extra Line Items</Label>
            <button
              type="button"
              onClick={() =>
                setExtraLines((lines) => [
                  ...lines,
                  { id: Date.now(), description: "", quantity: "1", unit: "", unitPrice: "0" },
                ])
              }
              className="flex items-center gap-1 text-xs font-medium text-accent-green hover:underline"
            >
              <Plus className="size-3.5" /> Add Line
            </button>
          </div>
          <div className="space-y-2">
            {extraLines.map((line) => (
              <div key={line.id} className="flex items-center gap-2">
                <input
                  name="extraDescription"
                  placeholder="Description"
                  defaultValue={line.description}
                  className="h-9 flex-1 rounded-lg border border-line bg-surface-raised px-2.5 text-xs"
                />
                <input
                  name="extraQuantity"
                  type="number"
                  placeholder="Qty"
                  defaultValue={line.quantity}
                  className="h-9 w-16 rounded-lg border border-line bg-surface-raised px-2.5 text-xs"
                />
                <input
                  name="extraUnit"
                  placeholder="Unit"
                  defaultValue={line.unit}
                  className="h-9 w-20 rounded-lg border border-line bg-surface-raised px-2.5 text-xs"
                />
                <input
                  name="extraUnitPrice"
                  type="number"
                  step="0.01"
                  placeholder="Price"
                  defaultValue={line.unitPrice}
                  className="h-9 w-24 rounded-lg border border-line bg-surface-raised px-2.5 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setExtraLines((lines) => lines.filter((l) => l.id !== line.id))}
                  className="text-text-muted hover:text-red"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
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
