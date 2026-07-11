"use client";

import { useActionState, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { savePlanAction } from "@/lib/actions/plans";
import type { ActionState } from "@/lib/actions/customers";
import type { PlanFull } from "@/lib/types/plan";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      {children}
    </div>
  );
}

export function PlanFormModal({ plan, onClose }: { plan: PlanFull | null; onClose: () => void }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(savePlanAction, undefined);
  const [isActive, setIsActive] = useState(plan?.isActive ?? true);

  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={plan ? `Edit ${plan.name}` : "Add Service Plan"}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="plan-form" loading={isPending}>
            {plan ? "Save Changes" : "Create Plan"}
          </Button>
        </>
      }
    >
      <form id="plan-form" action={formAction} className="space-y-4">
        {plan && <input type="hidden" name="id" value={plan.id} />}
        <input type="hidden" name="isActive" value={isActive ? "on" : ""} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Plan Name" required>
              <Input name="name" defaultValue={plan?.name} required minLength={2} />
            </Field>
          </div>
          <Field label="Provider" required>
            <Select name="provider" defaultValue={plan?.provider ?? "Starlink"} required>
              <option value="Starlink">Starlink</option>
              <option value="Fiber">Fiber</option>
              <option value="VSAT">VSAT</option>
              <option value="Other">Other</option>
            </Select>
          </Field>
          <Field label="Plan Type">
            <Select name="planType" defaultValue={plan?.planType ?? "DATA"}>
              <option value="DATA">Data</option>
              <option value="VOICE">Voice</option>
              <option value="HYBRID">Hybrid</option>
            </Select>
          </Field>
          <Field label="Monthly Price" required>
            <Input name="monthlyPrice" type="number" step="0.01" defaultValue={plan?.monthlyPrice} required />
          </Field>
          <Field label="Currency">
            <Input name="currency" defaultValue={plan?.currency ?? "USD"} />
          </Field>
          <Field label="Data Allowance (GB)">
            <Input
              name="dataAllowanceGB"
              type="number"
              step="1"
              placeholder="Blank = unlimited"
              defaultValue={plan?.dataAllowanceGB ?? undefined}
            />
          </Field>
          <Field label="Voice Minutes">
            <Input
              name="voiceMinutes"
              type="number"
              step="1"
              placeholder="Blank = N/A"
              defaultValue={plan?.voiceMinutes ?? undefined}
            />
          </Field>
          <Field label="SMS Count">
            <Input
              name="smsCount"
              type="number"
              step="1"
              placeholder="Blank = N/A"
              defaultValue={plan?.smsCount ?? undefined}
            />
          </Field>
          <Field label="Overage Rate / GB">
            <Input name="overageRatePerGB" type="number" step="0.01" defaultValue={plan?.overageRatePerGB} />
          </Field>
          <Field label="Overage Rate / Min">
            <Input name="overageRatePerMin" type="number" step="0.01" defaultValue={plan?.overageRatePerMin} />
          </Field>
          <Field label="Speed (Mbps)">
            <Input name="speedMbps" type="number" step="1" defaultValue={plan?.speedMbps ?? undefined} />
          </Field>
          <Field label="Shared Ratio">
            <Input name="sharedRatio" placeholder="e.g. 1:8" defaultValue={plan?.sharedRatio} />
          </Field>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-line bg-surface-raised p-3.5">
          <div>
            <p className="text-sm font-medium text-text-primary">Plan is active</p>
            <p className="text-xs text-text-muted">Inactive plans can&apos;t be assigned to new customers.</p>
          </div>
          <Switch checked={isActive} onChange={setIsActive} />
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
