"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import { saveRetailPlanAction } from "@/lib/actions/retailPlans";
import type { ActionState } from "@/lib/actions/customers";
import type { RetailPlanRow, PricingMethod } from "@/lib/types/retailBilling";
import { formatCurrency } from "@/lib/utils/format";

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      {children}
    </div>
  );
}

export function RetailPlanFormModal({ plan, onClose }: { plan: RetailPlanRow | null; onClose: () => void }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(saveRetailPlanAction, undefined);
  const [isActive, setIsActive] = useState(plan?.isActive ?? true);
  const [pricingMethod, setPricingMethod] = useState<PricingMethod>(plan?.pricingMethod ?? "PERCENTAGE_MARKUP");
  const [markupPercent, setMarkupPercent] = useState(String(plan?.markupPercent ?? 50));
  const [fixedPrice, setFixedPrice] = useState(String(plan?.fixedPrice ?? 0));
  const [wholesaleExample, setWholesaleExample] = useState("10");

  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  const example =
    pricingMethod === "PERCENTAGE_MARKUP"
      ? Number(wholesaleExample || 0) + (Number(wholesaleExample || 0) * Number(markupPercent || 0)) / 100
      : Number(fixedPrice || 0);

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={plan ? `Edit ${plan.name}` : "Add Retail Plan"}
      description="Define how a CDR's wholesale charge is repriced into a customer charge."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="retail-plan-form" loading={isPending}>
            {plan ? "Save Changes" : "Create Plan"}
          </Button>
        </>
      }
    >
      <form id="retail-plan-form" action={formAction} className="space-y-4">
        {plan && <input type="hidden" name="id" value={plan.id} />}
        <input type="hidden" name="isActive" value={isActive ? "on" : ""} />

        <Field label="Plan Name" required>
          <Input name="name" defaultValue={plan?.name} required minLength={2} placeholder="e.g. Business Plan A" />
        </Field>
        <Field label="Description">
          <Textarea name="description" defaultValue={plan?.description} rows={2} />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Pricing Method" required>
            <Select
              name="pricingMethod"
              value={pricingMethod}
              onChange={(e) => setPricingMethod(e.target.value as PricingMethod)}
            >
              <option value="PERCENTAGE_MARKUP">Percentage Markup</option>
              <option value="FIXED_PRICE">Fixed Retail Price</option>
            </Select>
          </Field>
          <Field label="Currency">
            <Input name="currency" defaultValue={plan?.currency ?? "USD"} />
          </Field>

          {pricingMethod === "PERCENTAGE_MARKUP" ? (
            <Field label="Markup %" required>
              <Input
                name="markupPercent"
                type="number"
                step="0.01"
                min={0}
                value={markupPercent}
                onChange={(e) => setMarkupPercent(e.target.value)}
                required
              />
            </Field>
          ) : (
            <Field label="Fixed Retail Price" required>
              <Input
                name="fixedPrice"
                type="number"
                step="0.01"
                min={0}
                value={fixedPrice}
                onChange={(e) => setFixedPrice(e.target.value)}
                required
              />
            </Field>
          )}
          {/* Keep the inactive field's value posted even while its input is hidden. */}
          {pricingMethod === "PERCENTAGE_MARKUP" && <input type="hidden" name="fixedPrice" value={fixedPrice} />}
          {pricingMethod === "FIXED_PRICE" && <input type="hidden" name="markupPercent" value={markupPercent} />}
        </div>

        <div className="rounded-xl border border-line bg-surface-raised p-3.5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Preview calculation</p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-text-secondary">Wholesale</span>
            <Input
              className="h-8 w-24 py-0"
              type="number"
              step="0.01"
              value={wholesaleExample}
              onChange={(e) => setWholesaleExample(e.target.value)}
            />
            <span className="text-text-muted">&rarr;</span>
            <span className="font-semibold text-accent-green">
              {formatCurrency(example, plan?.currency ?? "USD")}
            </span>
            <span className="text-xs text-text-muted">customer charge</span>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-line bg-surface-raised p-3.5">
          <div>
            <p className="text-sm font-medium text-text-primary">Plan is active</p>
            <p className="text-xs text-text-muted">Inactive plans can&apos;t be mapped to new identifiers.</p>
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
