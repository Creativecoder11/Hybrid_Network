"use client";

import { useActionState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { updateManualUsageAction, type ActionState } from "@/lib/actions/customers";
import { formatPeriodMonth } from "@/lib/utils/format";
import type { CustomerAccountRow, UsageHistoryRow } from "@/lib/types/admin";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/** Edit a month's usage for one Customer Account, or (usage = null) add a month. */
export function UsageHistoryEditModal({
  customerId,
  accounts,
  usage,
  onClose,
}: {
  customerId: string;
  accounts: CustomerAccountRow[];
  usage: UsageHistoryRow | null;
  onClose: () => void;
}) {
  const d = new Date();
  const thisMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    updateManualUsageAction,
    undefined
  );

  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  return (
    <Modal
      open
      onClose={onClose}
      title={usage ? `Edit usage — ${formatPeriodMonth(usage.periodMonth)}${usage.accountNumber ? ` · ${usage.accountNumber}` : ""}` : "Add manual usage"}
      description="Manual overrides are logged with a before/after snapshot in the activity log."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="usage-edit-form" loading={isPending}>
            Save
          </Button>
        </>
      }
    >
      <form
        id="usage-edit-form"
        action={formAction}
        className="space-y-4"
        onSubmit={(e) => {
          const monthInput = e.currentTarget.elements.namedItem("periodMonthDisplay") as HTMLInputElement | null;
          const hidden = e.currentTarget.elements.namedItem("periodMonth") as HTMLInputElement;
          if (monthInput?.value) hidden.value = monthInput.value.replace("-", "");
        }}
      >
        <input type="hidden" name="customerId" value={customerId} />
        <input type="hidden" name="periodMonth" defaultValue={usage?.periodMonth ?? thisMonth.replace("-", "")} />
        {usage?.accountId ? (
          <input type="hidden" name="customerAccountId" value={usage.accountId} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Customer Account">
              <Select name="customerAccountId" defaultValue={accounts[0]?.id ?? ""} required>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.accountNumber}
                    {a.name ? ` · ${a.name}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            {!usage && (
              <Field label="Period">
                <Input name="periodMonthDisplay" type="month" defaultValue={thisMonth} required />
              </Field>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Volume Data (GB)">
            <Input name="volumeDataBytesGb" type="number" step="0.01" defaultValue={usage?.volumeDataGB} />
          </Field>
          <Field label="Volume Min">
            <Input name="volumeMin" type="number" step="1" defaultValue={usage?.volumeMin} />
          </Field>
          <Field label="Volume Msg">
            <Input name="volumeMsg" type="number" step="1" defaultValue={usage?.volumeMsg} />
          </Field>
          <Field label="Volume In Bundle (GB)">
            <Input
              name="volumeInBundleBytesGb"
              type="number"
              step="0.01"
              defaultValue={usage?.volumeInBundleGB}
            />
          </Field>
          <Field label="Volume Out Bundle (GB)">
            <Input
              name="volumeOutBundleBytesGb"
              type="number"
              step="0.01"
              defaultValue={usage?.volumeOutBundleGB}
            />
          </Field>
          <Field label="Volume Total (GB)">
            <Input name="volumeTotalBytesGb" type="number" step="0.01" defaultValue={usage?.volumeTotalGB} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Consumption — Money">
            <Input name="consumptionMoney" type="number" step="0.01" defaultValue={usage?.consumptionMoney} />
          </Field>
          <Field label="Consumption — Data (GB)">
            <Input
              name="consumptionDataBytesGb"
              type="number"
              step="0.01"
              defaultValue={usage?.consumptionDataGB}
            />
          </Field>
          <Field label="Consumption — Minutes">
            <Input name="consumptionMin" type="number" step="1" defaultValue={usage?.consumptionMin} />
          </Field>
          <Field label="Consumption — Messages">
            <Input name="consumptionMsg" type="number" step="1" defaultValue={usage?.consumptionMsg} />
          </Field>
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
