"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import type { ActionState } from "@/lib/actions/customers";

function currentPeriodMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

export function GenerateInvoicesModal({
  count,
  onClose,
  onConfirm,
}: {
  count: number;
  onClose: () => void;
  onConfirm: (periodMonth: string, dueDate: string) => Promise<ActionState>;
}) {
  const periodDefault = currentPeriodMonth();
  const [periodMonthDisplay, setPeriodMonthDisplay] = useState(
    `${periodDefault.slice(0, 4)}-${periodDefault.slice(4, 6)}`
  );
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    setPending(true);
    setError("");
    const periodMonth = periodMonthDisplay.replace("-", "");
    const result = await onConfirm(periodMonth, dueDate);
    setPending(false);
    if (result?.error) setError(result.error);
    else onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Generate Invoices"
      description={`Bundle ${count} selected charge record${count === 1 ? "" : "s"} into invoices, grouped by customer.`}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} loading={pending}>
            Generate
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label required>Billing Period</Label>
          <Input
            type="month"
            value={periodMonthDisplay}
            onChange={(e) => setPeriodMonthDisplay(e.target.value)}
            required
          />
        </div>
        <div>
          <Label required>Due Date</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        </div>
        {error && (
          <div className="rounded-xl border border-red/30 bg-red/10 px-3.5 py-2.5 text-xs text-red">{error}</div>
        )}
      </div>
    </Modal>
  );
}
