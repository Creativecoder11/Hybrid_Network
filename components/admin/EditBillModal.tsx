"use client";

import { useActionState, useEffect } from "react";
import { CreditCard } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { updateInvoiceAction } from "@/lib/actions/invoices";
import type { ActionState } from "@/lib/actions/customers";
import type { InvoiceListRow } from "@/lib/types/billing";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "DUE", label: "Due" },
  { value: "PAID", label: "Paid" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function EditBillModal({
  invoice,
  onClose,
}: {
  invoice: InvoiceListRow;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    updateInvoiceAction,
    undefined
  );

  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  const dueDateValue = invoice.dueDate.slice(0, 10);
  const periodValue = `${invoice.periodMonth.slice(0, 4)}-${invoice.periodMonth.slice(4, 6)}`;

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit Bill"
      description={`${invoice.invoiceNumber} · ${invoice.customerName}`}
      size="md"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-bill-form" loading={isPending}>
            Save Changes
          </Button>
        </>
      }
    >
      <form
        id="edit-bill-form"
        action={formAction}
        className="space-y-4"
        onSubmit={(e) => {
          const monthInput = e.currentTarget.elements.namedItem("periodMonthDisplay") as HTMLInputElement;
          const hidden = e.currentTarget.elements.namedItem("periodMonth") as HTMLInputElement;
          if (monthInput?.value) hidden.value = monthInput.value.replace("-", "");
        }}
      >
        <input type="hidden" name="invoiceId" value={invoice.id} />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label required>Amount</Label>
            <Input
              name="amount"
              type="number"
              min={0}
              step="0.01"
              icon={<CreditCard className="size-4" />}
              defaultValue={invoice.subtotal}
              required
            />
            <p className="mt-1 text-[11px] text-text-muted">Pre-tax — tax is recalculated automatically.</p>
          </div>
          <div>
            <Label required>Due Date</Label>
            <Input name="dueDate" type="date" defaultValue={dueDateValue} required />
          </div>
          <div>
            <Label required>Billing Period</Label>
            <input type="hidden" name="periodMonth" defaultValue={invoice.periodMonth} />
            <Input name="periodMonthDisplay" type="month" defaultValue={periodValue} required />
          </div>
          <div>
            <Label required>Bill Status</Label>
            <Select name="status" defaultValue={invoice.status}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
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
