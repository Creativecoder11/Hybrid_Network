"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";

export function MarkPaidModal({
  title,
  onClose,
  onConfirm,
}: {
  title: string;
  onClose: () => void;
  onConfirm: (paymentMethod: string, paidDate: string) => Promise<{ error?: string; success?: string } | undefined>;
}) {
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [pending, setPending] = useState(false);

  async function handleSubmit() {
    setPending(true);
    const result = await onConfirm(paymentMethod, paidDate);
    setPending(false);
    if (result?.error) toast.error(result.error);
    else {
      toast.success(result?.success ?? "Marked as paid.");
      onClose();
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} loading={pending}>
            Confirm Payment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label required>Payment Method</Label>
          <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Credit Card">Credit Card</option>
            <option value="Cash">Cash</option>
            <option value="Cheque">Cheque</option>
            <option value="Other">Other</option>
          </Select>
        </div>
        <div>
          <Label required>Payment Date</Label>
          <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
