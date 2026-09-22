"use client";

import { useActionState, useEffect, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { saveCustomerAccountAction } from "@/lib/actions/accounts";
import { formatCurrency } from "@/lib/utils/format";
import type { ActionState } from "@/lib/actions/customers";
import type { CustomerAccountRow, PlanOption } from "@/lib/types/admin";

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-text-muted">{hint}</p>}
    </div>
  );
}

export function CustomerAccountFormModal({
  customerId,
  account,
  plans,
  onClose,
}: {
  customerId: string;
  account: CustomerAccountRow | null;
  plans: PlanOption[];
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(saveCustomerAccountAction, undefined);

  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={account ? `Edit account ${account.accountNumber}` : "Add Customer Account"}
      description="The account number is the Customer Code on CDR files. CDR rows are only allocated to it when the code matches exactly (case-insensitive)."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="account-form" loading={isPending}>
            {account ? "Save Account" : "Add Account"}
          </Button>
        </>
      }
    >
      <form id="account-form" action={formAction} className="space-y-4">
        <input type="hidden" name="customerId" value={customerId} />
        {account && <input type="hidden" name="id" value={account.id} />}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Account Number (Customer Code)" required>
            <Input name="accountNumber" defaultValue={account?.accountNumber} required placeholder="e.g. 10001" className="font-mono" />
          </Field>
          <Field label="Account Name">
            <Input name="name" defaultValue={account?.name} placeholder="e.g. MV Pacific Star" />
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={account?.status ?? "ACTIVE"}>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="CLOSED">Closed (CDR rows become unallocated)</option>
            </Select>
          </Field>
          <Field label="Service Plan">
            <Select name="planId" defaultValue={account?.planId ?? ""}>
              <option value="">-- No plan --</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({formatCurrency(p.monthlyPrice, p.currency)}/mo)
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Static IP">
            <Input name="staticIp" defaultValue={account?.staticIp} placeholder="Optional" />
          </Field>
        </div>

        <div>
          <p className="mb-2 mt-2 text-xs font-bold uppercase tracking-wider text-accent-green">Starlink / SLASH</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field
                label="Starlink Vessel ID(s)"
                hint="From the SLASH dashboard. Devices, live status, usage and location for this account come from these vessels. One per line or comma separated."
              >
                <Textarea name="starlinkVesselIds" rows={2} defaultValue={account?.starlinkVesselIds.join("\n")} className="font-mono text-xs" />
              </Field>
            </div>
            <Field label="Starlink Account Number" hint="e.g. ACC-1234567-12345-12 — needed for SLASH service-line WRITE actions.">
              <Input name="slashAccountNumber" defaultValue={account?.slashAccountNumber} className="font-mono" />
            </Field>
          </div>
        </div>

        <div>
          <p className="mb-2 mt-2 text-xs font-bold uppercase tracking-wider text-accent-green">CDR matching</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="ICCID / Kit IDs" hint="Only used for CDR rows that have no Customer Code.">
              <Textarea name="iccids" rows={2} defaultValue={account?.iccids.join("\n")} className="font-mono text-xs" />
            </Field>
            <Field label="Card Name" hint="Only used for CDR rows that have no Customer Code.">
              <Input name="cardName" defaultValue={account?.cardName} />
            </Field>
            <div className="sm:col-span-2">
              <Field
                label="Allowed Product Codes (optional)"
                hint="Leave empty to allow every active Product Code. When set, CDR rows with any other product become unallocated for this account."
              >
                <Input name="allowedProductCodes" defaultValue={account?.allowedProductCodes.join(", ")} className="font-mono" />
              </Field>
            </div>
          </div>
        </div>

        <Field label="Notes">
          <Textarea name="notes" rows={2} defaultValue={account?.notes} />
        </Field>

        {state?.error && (
          <div className="rounded-xl border border-red/30 bg-red/10 px-3.5 py-2.5 text-xs text-red">{state.error}</div>
        )}
      </form>
    </Modal>
  );
}
